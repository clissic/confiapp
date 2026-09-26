import type { Request, Response } from 'express';

import { AuthService } from './service';
import { IdDigitalService } from './id-digital.service';
import type {
  ChangePasswordBody,
  ForgotPasswordBody,
  LoginBody,
  RegisterBody,
  ResendVerificationBody,
  ResetPasswordBody,
  VerifyEmailBody,
} from './validation';

export class AuthController {
  constructor(
    private readonly service = new AuthService(),
    private readonly idDigital = new IdDigitalService(),
  ) {}

  private meta(req: Request) {
    return {
      userAgent: req.get('user-agent') ?? undefined,
      ipAddress: req.ip,
    };
  }

  register = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as RegisterBody;
    const result = await this.service.register(body);
    res.status(201).json(result);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as LoginBody;
    const session = await this.service.login(body.email, body.password, this.meta(req));
    this.service.setRefreshCookie(res, session.tokens.refreshToken);
    res.status(200).json(session);
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const session = await this.service.refresh(req, this.meta(req));
    this.service.setRefreshCookie(res, session.tokens.refreshToken);
    res.status(200).json(session);
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const allDevices = Boolean((req.body as { allDevices?: boolean })?.allDevices);
    const result = await this.service.logout(req, allDevices);
    this.service.clearRefreshCookie(res);
    res.status(200).json(result);
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as ChangePasswordBody;
    const result = await this.service.changePassword(
      req.user!.id,
      body.currentPassword,
      body.newPassword,
    );
    this.service.clearRefreshCookie(res);
    res.status(200).json(result);
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as ForgotPasswordBody;
    const result = await this.service.forgotPassword(body.email);
    res.status(200).json(result);
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as ResetPasswordBody;
    const result = await this.service.resetPassword(body.token, body.newPassword);
    this.service.clearRefreshCookie(res);
    res.status(200).json(result);
  };

  verifyEmail = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as VerifyEmailBody;
    const result = await this.service.verifyEmail(body.token);
    res.status(200).json(result);
  };

  resendVerification = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as ResendVerificationBody;
    const result = await this.service.resendVerification(body.email);
    res.status(200).json(result);
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.me(req.user!.id);
    res.status(200).json(user);
  };

  idDigitalStatus = async (req: Request, res: Response): Promise<void> => {
    const data = await this.idDigital.getStatus(req.user!.id);
    res.status(200).json(data);
  };

  idDigitalStart = async (req: Request, res: Response): Promise<void> => {
    const purpose = String(req.query.purpose ?? '');
    const ref = typeof req.query.ref === 'string' ? req.query.ref : undefined;
    if (purpose !== 'agent_onboarding' && purpose !== 'accept_job') {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'purpose debe ser agent_onboarding o accept_job',
      });
      return;
    }
    const data = await this.idDigital.start({
      userId: req.user!.id,
      purpose,
      ref,
    });
    res.status(200).json(data);
  };

  idDigitalCallback = async (req: Request, res: Response): Promise<void> => {
    const { redirectUrl } = await this.idDigital.handleCallback({
      code: typeof req.query.code === 'string' ? req.query.code : undefined,
      state: typeof req.query.state === 'string' ? req.query.state : undefined,
      error: typeof req.query.error === 'string' ? req.query.error : undefined,
      error_description:
        typeof req.query.error_description === 'string'
          ? req.query.error_description
          : undefined,
    });
    res.redirect(302, redirectUrl);
  };
}
