import { Router } from "express";
import { authenticateToken, requireRole } from "../auth/authMiddleware.js";
import { productionRepository } from "../db/repositories/ProductionRepository.js";
import { ConfigurationValidationError } from "../db/repositories/ConfigurationRepository.js";
export const productionRouter = Router();
productionRouter.post(
  "/production/commands",
  authenticateToken,
  requireRole("admin", "factory_worker", "coordinator"),
  async (req, res) => {
    try {
      const result = await productionRepository.command(
        req.body,
        req.userSession!,
      );
      res.json({ success: true, result });
    } catch (error) {
      const validation = error instanceof ConfigurationValidationError;
      res
        .status(validation ? error.status : 503)
        .json({
          success: false,
          message: validation
            ? error.message
            : "No se pudo confirmar la producción. Conservá los datos y reintentá con el mismo identificador.",
        });
    }
  },
);
