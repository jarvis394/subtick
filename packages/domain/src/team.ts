export const SIDES = ['T', 'CT'] as const
export type Side = (typeof SIDES)[number]

export const isSide = (value: unknown): value is Side => SIDES.includes(value as Side)

/** Source engine team numbers. 0/1 are unassigned/spectators. */
export const TEAM_NUM = { T: 2, CT: 3 } as const satisfies Record<Side, number>

export const sideFromTeamNum = (teamNum: number | null | undefined): Side | null =>
  teamNum === TEAM_NUM.T ? 'T' : teamNum === TEAM_NUM.CT ? 'CT' : null

export const otherSide = (side: Side): Side => (side === 'T' ? 'CT' : 'T')
