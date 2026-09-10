import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authService } from '@/services/auth.service';
import { authenticate } from '@/middleware/auth.middleware';
import { successResponse, createdResponse } from '@/lib/api-response';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema, refreshTokenSchema, changePasswordSchema } from '@/validations/auth.validation';

const router = Router();

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    return createdResponse(res, result, 'Account created successfully');
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data, req.headers['user-agent'], req.ip);
    return successResponse(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await authService.logout(refreshToken);
    return successResponse(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    const tokens = await authService.refreshTokens(refreshToken);
    return successResponse(res, tokens, 'Tokens refreshed');
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await authService.forgotPassword(email);
    return successResponse(res, result, 'If that email is registered, a reset link has been sent');
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(validated);
    return successResponse(res, result, 'Password reset successfully');
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = changePasswordSchema.parse(req.body);
    const result = await authService.changePassword(req.userId!, validated);
    return successResponse(res, result, 'Password updated successfully');
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getMe(req.userId!);
    return successResponse(res, user, 'Profile retrieved');
  } catch (err) {
    next(err);
  }
});

export default router;
