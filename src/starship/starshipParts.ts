/** Parts and hinge names shared by the main-thread rig and worker payload. */
export const VEHICLE_PARTS: ReadonlySet<string> = new Set([
  'Ship_Hull', 'Ship_TPS', 'Ship_Flaps', 'Ship_Engines', 'Ship_Details',
  'Booster_Hull', 'Booster_HotStage', 'Booster_GridFins', 'Booster_Chines',
  'Booster_Engines', 'Booster_Details',
])

export const TOWER_ARM_P = 'Tower_ArmP'
export const TOWER_ARM_N = 'Tower_ArmN'
export const TOWER_QD_ARM = 'Tower_QDArm'
