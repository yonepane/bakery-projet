import { Request, Response, NextFunction } from 'express';
import { Connection } from 'mongoose';
import Bakery from '../models/master/Bakery';
import { getTenantConnection } from '../config/tenant-connection';

/**
 * Middleware to attach the tenant-specific database connection to the request.
 * Assumes req.user is already populated with bakeryId by an auth middleware.
 */
export const tenantMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // req.user is assumed to be populated by auth middleware
    const bakeryId = (req.user as any)?.bakeryId;

    if (!bakeryId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Bakery context missing from user session'
      });
    }

    // Lookup Bakery in Master DB to get tenant connection info
    const bakery = await Bakery.findById(bakeryId);

    if (!bakery) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Bakery account not found'
      });
    }

    // Get (or create) the tenant connection and attach to request
    try {
      const tenantDb = getTenantConnection(bakery.tenantDbUri);
      (req as any).tenantDb = tenantDb;
      next();
    } catch (connError) {
      console.error(`Failed to connect to tenant DB for bakery ${bakeryId}:`, connError);
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Could not connect to tenant database'
      });
    }
  } catch (error) {
    console.error('Tenant middleware error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while resolving tenant context'
    });
  }
};

export default tenantMiddleware;
