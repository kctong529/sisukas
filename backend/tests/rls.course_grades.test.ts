// tests/rls.course_grades.test.ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { setupRLSTest, teardownRLSTest, RLSTestContext } from "./rls.setup";
import { setUser1Session, setUser2Session } from "./rls.session-helper";

describe.sequential("Course Grades RLS", () => {
  let ctx: RLSTestContext;

  beforeEach(async () => {
    ctx = await setupRLSTest();
  });

  afterEach(async () => {
    await teardownRLSTest(ctx);
  });

  const COURSE_UNIT_ID = "aalto-OPINKOHD-1125597074-20210801";

  async function insertGradeAsUser(userSession: any, userId: string, grade: number) {
    await ctx.supabase.auth.setSession(userSession);

    // NOTE: Your schema uses snake_case columns.
    const { data, error } = await ctx.supabase
      .from("course_grades")
      .insert({
        user_id: userId,
        course_unit_id: COURSE_UNIT_ID,
        grade,
      })
      .select();

    return { data, error };
  }

  it("should allow User 1 to insert and read their own grade", async () => {
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION);

    const { data: inserted, error: insertError } = await ctx.supabase
      .from("course_grades")
      .insert({
        user_id: ctx.USER_1_ID,
        course_unit_id: COURSE_UNIT_ID,
        grade: 5,
      })
      .select();

    expect(insertError).toBeNull();
    expect(inserted?.[0]?.user_id).toBe(ctx.USER_1_ID);
    expect(inserted?.[0]?.course_unit_id).toBe(COURSE_UNIT_ID);
    expect(inserted?.[0]?.grade).toBe(5);

    const { data: rows, error: selectError } = await ctx.supabase.from("course_grades").select("*");
    expect(selectError).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.user_id).toBe(ctx.USER_1_ID);
  });

  it("should allow User 2 to see only their own grade (not User 1's)", async () => {
    // Create User 1 grade
    await insertGradeAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 4);
    // Create User 2 grade
    await insertGradeAsUser(ctx.USER_2_SESSION, ctx.USER_2_ID, 3);

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION);

    const { data: rows, error } = await ctx.supabase.from("course_grades").select("*");
    expect(error).toBeNull();

    // User2 should only see their own rows
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.user_id).toBe(ctx.USER_2_ID);
    expect(rows?.[0]?.grade).toBe(3);
  });

  it("should prevent User 2 from selecting User 1 grade by filters", async () => {
    await insertGradeAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 5);

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION);

    const { data: rows, error } = await ctx.supabase
      .from("course_grades")
      .select("*")
      .eq("user_id", ctx.USER_1_ID)
      .eq("course_unit_id", COURSE_UNIT_ID);

    expect(error).toBeNull();
    expect(rows).toEqual([]);
  });

  it("should prevent User 2 from inserting a grade for User 1", async () => {
    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION);

    const { error } = await ctx.supabase.from("course_grades").insert({
      user_id: ctx.USER_1_ID,
      course_unit_id: COURSE_UNIT_ID,
      grade: 1,
    });

    expect(error).not.toBeNull();
  });

  it("should allow User 1 to update their own grade", async () => {
    await insertGradeAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 2);

    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION);

    const { error: updateError } = await ctx.supabase
      .from("course_grades")
      .update({ grade: 5 })
      .eq("user_id", ctx.USER_1_ID)
      .eq("course_unit_id", COURSE_UNIT_ID);

    expect(updateError).toBeNull();

    const { data: rows, error: selectError } = await ctx.supabase
      .from("course_grades")
      .select("grade")
      .eq("course_unit_id", COURSE_UNIT_ID);

    expect(selectError).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.grade).toBe(5);
  });

  it("should prevent User 2 from updating User 1 grade", async () => {
    await insertGradeAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 4);

    // Try to update as User 2
    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION);

    const { data: updatedRows, error: updateError } = await ctx.supabase
      .from("course_grades")
      .update({ grade: 0 })
      .eq("user_id", ctx.USER_1_ID)
      .eq("course_unit_id", COURSE_UNIT_ID)
      .select();

    // RLS may either:
    // - return an error (sometimes), OR
    // - silently affect 0 rows (common)
    if (updateError) {
      expect(updateError).not.toBeNull();
    } else {
      expect(updatedRows ?? []).toHaveLength(0);
    }

    // Verify unchanged as User 1
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION);

    const { data: rows, error: selectError } = await ctx.supabase
      .from("course_grades")
      .select("grade")
      .eq("user_id", ctx.USER_1_ID)
      .eq("course_unit_id", COURSE_UNIT_ID);

    expect(selectError).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.grade).toBe(4);
  });

  it("should allow User 1 to delete their own grade", async () => {
    await insertGradeAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 3);

    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION);

    const { error: deleteError } = await ctx.supabase
      .from("course_grades")
      .delete()
      .eq("user_id", ctx.USER_1_ID)
      .eq("course_unit_id", COURSE_UNIT_ID);

    expect(deleteError).toBeNull();

    const { data: rows, error: selectError } = await ctx.supabase
      .from("course_grades")
      .select("*")
      .eq("user_id", ctx.USER_1_ID)
      .eq("course_unit_id", COURSE_UNIT_ID);

    expect(selectError).toBeNull();
    expect(rows).toEqual([]);
  });

  it("should prevent User 2 from deleting User 1 grade", async () => {
    await insertGradeAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 5);

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION);

    const { error: deleteError } = await ctx.supabase
      .from("course_grades")
      .delete()
      .eq("user_id", ctx.USER_1_ID)
      .eq("course_unit_id", COURSE_UNIT_ID);

    // Depending on PostgREST config, this is typically an RLS error. Either way we verify it still exists.
    if (deleteError) {
      expect(deleteError).not.toBeNull();
    }

    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION);

    const { data: rows, error: selectError } = await ctx.supabase
      .from("course_grades")
      .select("*")
      .eq("user_id", ctx.USER_1_ID)
      .eq("course_unit_id", COURSE_UNIT_ID);

    expect(selectError).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.grade).toBe(5);
  });
});
