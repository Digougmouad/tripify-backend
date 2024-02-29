import { NextFunction, Request, Response } from 'express';
import { RequestWithUser } from '@interfaces/auth.interface';
import { User } from '@interfaces/users.interface';
import AuthService from '@services/auth.service';

class AuthController {
  public authService = new AuthService();

  public signUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userData = req.body.data;
      const signUpUserData = await this.authService.signup(userData);

      signUpUserData.message ? res.status(400).json(signUpUserData) : res.status(201).json(signUpUserData);
    } catch (error) {
      console.log(error);
    }
  };

  public logIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userData = req.body;
      const loggedInData = await this.authService.login(userData);
      loggedInData.message ? res.status(403).json(loggedInData) : res.status(200).json(loggedInData);
    } catch (error) {
      console.log(error);
    }
  };

  public resendVerificationEMail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = String(req.params.email);
      await this.authService.resendVerificationEmail(email);
      res.status(200);
    } catch (error) {
      console.log(error);
    }
  };

  public changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userData = req.body;
      const email: string = String(req.params.email);
      const chengedData = await this.authService.changePassword(email, userData);
      console.log(chengedData.message);
      
      res.status(200).json(chengedData);
    } catch (error) {
      console.log(error);
    }
  };

  public generateRefreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.body.id;
      const loggedInData = await this.authService.refreshToken(id);
      res.status(200).json(loggedInData);
    } catch (error) {
      next(error);
    }
  };

  public logOut = async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userData: User = req.user;
      const logOutUserData: User = await this.authService.logout(userData);

      res.setHeader('Set-Cookie', ['Authorization=; Max-age=0']);
      res.status(200).json({ data: logOutUserData, message: 'logout' });
    } catch (error) {
      next(error);
    }
  };
}

export default AuthController;
