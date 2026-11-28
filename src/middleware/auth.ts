import type { NextFunction, Request, Response } from 'express';
import { verifyStaffToken } from '../lib/staffAuth.ts';
import { getStaffMemberByUsername } from '../store/staff.ts';
import type { StaffMemberDTO } from '../store/staff.ts';

export interface StaffAuthRequest extends Request {
  staff?: StaffMemberDTO;
}

export const requireStaffAuth = (
  req: StaffAuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing session token' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifyStaffToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    return;
  }

  const staff = getStaffMemberByUsername(payload.sub);
  if (!staff || !staff.isActive) {
    res.status(403).json({
      error: 'Access denied: This staff account is inactive or no longer authorized.',
    });
    return;
  }

  req.staff = staff;
  next();
};
