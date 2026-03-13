import { db, userAccessTable, orgLevel1Table, orgLevel2Table, squadsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

export type AccessFilter = {
  unrestricted: boolean;
  squadIds: number[];
  level2Ids: number[];
  level1Ids: number[];
};

/**
 * Returns the access filter for a given user.
 * Admins are always unrestricted.
 * Users with no grants are unrestricted.
 * Users with grants only see data within those grants (hierarchically expanded).
 */
export async function getUserAccess(userId: number, userRole: string): Promise<AccessFilter> {
  if (userRole === "admin") {
    return { unrestricted: true, squadIds: [], level2Ids: [], level1Ids: [] };
  }

  const rows = await db.select().from(userAccessTable).where(eq(userAccessTable.userId, userId));

  // 0 rows = unrestricted
  if (rows.length === 0) {
    return { unrestricted: true, squadIds: [], level2Ids: [], level1Ids: [] };
  }

  // Only sentinel row = restricted to nothing
  const realGrants = rows.filter(r => r.grantType !== "none");
  if (realGrants.length === 0) {
    return { unrestricted: false, squadIds: [], level2Ids: [], level1Ids: [] };
  }

  const grants = realGrants;
  const grantedLevel1Ids = grants.filter(g => g.grantType === "level1").map(g => g.grantId);
  const grantedLevel2Ids = grants.filter(g => g.grantType === "level2").map(g => g.grantId);
  const grantedSquadIds = grants.filter(g => g.grantType === "squad").map(g => g.grantId);

  // Expand level1 grants → all level2s under them
  let expandedLevel2Ids = [...grantedLevel2Ids];
  if (grantedLevel1Ids.length > 0) {
    const level2sUnderLevel1 = await db
      .select({ id: orgLevel2Table.id })
      .from(orgLevel2Table)
      .where(inArray(orgLevel2Table.level1Id, grantedLevel1Ids));
    expandedLevel2Ids = [...new Set([...expandedLevel2Ids, ...level2sUnderLevel1.map(r => r.id)])];
  }

  // Expand level2 grants → all squads under them
  let expandedSquadIds = [...grantedSquadIds];
  if (expandedLevel2Ids.length > 0) {
    const squadsUnderLevel2 = await db
      .select({ id: squadsTable.id })
      .from(squadsTable)
      .where(inArray(squadsTable.level2Id, expandedLevel2Ids));
    expandedSquadIds = [...new Set([...expandedSquadIds, ...squadsUnderLevel2.map(r => r.id)])];
  }

  return {
    unrestricted: false,
    level1Ids: grantedLevel1Ids,
    level2Ids: expandedLevel2Ids,
    squadIds: expandedSquadIds,
  };
}
