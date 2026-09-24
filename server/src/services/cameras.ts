import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';

export const cameraInclude = {
  house: { select: { id: true, address: true } },
} satisfies Prisma.CameraInclude;

export type CameraWithHouse = Prisma.CameraGetPayload<{ include: typeof cameraInclude }>;

export async function listCamerasOfHouse(houseId: number): Promise<CameraWithHouse[]> {
  return prisma.camera.findMany({
    where: { houseId },
    include: cameraInclude,
    orderBy: { id: 'asc' },
  });
}
