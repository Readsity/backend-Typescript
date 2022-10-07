/* eslint-disable @typescript-eslint/no-unused-vars */
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import models from "../models";
import { successResponse, errorResponse, handleError } from "../utils/responses";
import jwtHelper from "../utils/jwt";
import { IUser, IOtp, IFilter } from "../utils/interface";
import sendEmail from "../utils/email";

const { generateToken } = jwtHelper;
/**
 * @class UserController
 * @description create, log in user
 * @exports UserController
 */
export default class UserController {
  /**
   * @param {object} req - The reset request object
   * @param {object} res - The reset errorResponse object
   * @returns {object} Success message
   */
  static async createUser(req: Request, res: Response) {
    try {
      const {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        firstName, lastName, phone, email, password, retypePassword
      } = req.body;
      const emailExist = await models.User.findOne({ email });
      if (emailExist) {
        return errorResponse(res, 409, "email already registered by another user.");
      }
      const phoneExist = await models.User.findOne({ phone });
      if (phoneExist) {
        return errorResponse(res, 409, "phone number already used by another user.");
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const secondPassword = await models.User.findOne({ password });
      if (secondPassword !== retypePassword) {
        return errorResponse(res, 409, "password mismatch");
      }
      await models.User.create({
        firstName, lastName, email, password: hashedPassword, phone
      });
      const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
      await models.Otp.create({ email, token: otp });
      const subject = "User created";
      const message = `hi, thank you for signing up to Readsity kindly verify your account with this token ${otp}`;
      await sendEmail(email, subject, message);
      return successResponse(res, 201, "Account created successfully, kindly verify your email and login.");
    } catch (error) {
      handleError(error, req);
      return errorResponse(res, 500, "Server error.");
    }
  }

  /**
   * @param {object} req - The reset request object
   * @param {object} res - The reset errorResponse object
   * @returns {object} Success message
   */
  static async loginUser(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const user: IUser | null = await models.User.findOne({ email });
      if (!user) { return errorResponse(res, 404, "Email does not exist."); }
      if (!user.verified) {
        return errorResponse(res, 409, "Kindly verify your account before logging in.");
      }
      if (user.active !== true) { return errorResponse(res, 403, "Account has been deactivated. Please contact admin."); }
      const validpass = await bcrypt.compare(password, user.password);
      if (!validpass) { return errorResponse(res, 404, "Password is not correct!."); }
      const { _id, phone } = user;
      const token = await generateToken({ _id, email, phone });
      if (user.active !== true) {
        return errorResponse(res, 403, "User account temporarily on hold, contact admin");
      }
      const userDetails = {
        _id, email, firstname: user.firstName, lastName: user.lastName, phone: user.phone, role: user.role, active: user.active
      };
      return successResponse(
        res,
        200,
        "User Logged in Successfully.",
        { token, userDetails }
      );
    } catch (error) {
      handleError(error, req);
      return errorResponse(res, 500, "Server error");
    }
  }

  /**
   * @param {object} req - The reset request object
   * @param {object} res - The reset errorResponse object
   * @returns {object} Success message
   */
  static async resendOtp(req: Request, res: Response) {
    try {
      const { email } = req.body;
      const user: IUser | null = await models.User.findOne({ email });
      if (!user) { return errorResponse(res, 404, "Email does not exist."); }
      const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
      await models.Otp.findOneAndUpdate(email, { token: otp, expired: false });
      const subject = "Resend otp";
      const message = `hi, kindly verify your account with this token ${otp}`;
      await sendEmail(email, subject, message);
      return successResponse(
        res,
        201,
        "A token has been sent to your account for verification."
      );
    } catch (error) {
      handleError(error, req);
      return errorResponse(res, 500, "Server error");
    }
  }

  /**
   * @param {object} req - The reset request object
   * @param {object} res - The reset errorResponse object
   * @returns {object} Success message
   */
  static async verifyAccount(req: Request, res: Response) {
    try {
      const { token } = req.body;
      const otp: IOtp | null = await models.Otp.findOne({ token });
      if (!otp) { return errorResponse(res, 404, "Otp does not exist."); }
      if (otp.expired) { return errorResponse(res, 409, "Otp has already been used."); }

      await models.User.findOneAndUpdate({ email: otp.email }, { verified: true });
      await models.Otp.findOneAndUpdate({ email: otp.email }, { expired: true });
      return successResponse(
        res,
        200,
        "Account verified successfully kindly login."
      );
    } catch (error) {
      handleError(error, req);
      return errorResponse(res, 500, "Server error");
    }
  }

  /**
   * @param {object} req - The reset request object
   * @param {object} res - The reset errorResponse object
   * @returns {object} Success message
   */
  static async getAllUsers(req: Request, res: Response) {
    try {
      const { status, role, name } = req.query;
      const filter = {} as IFilter;
      status ? filter.verified = status as string : filter.verified = "true";
      role ? filter.role = role as string : filter.role = "user";
      if (name) {
        filter.$text = {
          $search: name as string
        };
      }
      const users = await models.User.find(filter).select("-password");
      return successResponse(
        res,
        200,
        "Account verified successfully kindly login.",
        { total: users.length, users }
      );
    } catch (error) {
      handleError(error, req);
      return errorResponse(res, 500, "Server error");
    }
  }

  /**
   * @param {object} req - The reset request object
   * @param {object} res - The reset errorResponse object
   * @returns {object} Success message
   */
  static async recover(req: Request, res: Response) {
    try {
      const { email } = req.body;
      const user = await models.User.findOne({ email });
      if (!user) { return errorResponse(res, 404, "Email does not exist."); }
      const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
      await models.Otp.findOneAndUpdate(
        email,
        { token: otp, expired: false },
        { upsert: true }
      );
      const subject = "Reset Password Otp";
      const message = `hi, kindly use this ${otp} to reset your password`;
      await sendEmail(email, subject, message);
      return successResponse(res, 200, "Kindly use the otp in your mail to reset your password.");
    } catch (error) {
      handleError(error, req);
      return errorResponse(res, 500, "Server error");
    }
  }

  /**
   * @param {object} req - The reset request object
   * @param {object} res - The reset errorResponse object
   * @returns {object} Success message
   */
  static async reset(req: Request, res: Response) {
    try {
      const { token, password, retypePassword } = req.body;
      const otp = await models.Otp.findOne({ token });
      if (!otp) { return errorResponse(res, 404, "incorrect Otp"); }
      if (password !== retypePassword) {
        return errorResponse(res, 409, "Password mismatch.");
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await models.User.findOneAndUpdate({ email: otp.email }, { password: hashedPassword });
      return successResponse(res, 200, "Password reset successfully, Kindly login.");
    } catch (error) {
      handleError(error, req);
      return errorResponse(res, 500, "Server error");
    }
  }
}
