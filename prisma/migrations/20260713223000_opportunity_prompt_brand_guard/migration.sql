-- CreateFunction
CREATE FUNCTION "enforce_opportunity_prompt_version_brand_match"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prompt_brand_id TEXT;
BEGIN
  SELECT prompt."brandId"
  INTO prompt_brand_id
  FROM "PromptVersion" AS prompt_version
  JOIN "Prompt" AS prompt ON prompt.id = prompt_version."promptId"
  WHERE prompt_version.id = NEW."promptVersionId";

  -- 不覆盖原有 PromptVersion 外键对不存在记录的错误语义。
  IF prompt_brand_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."brandId" IS DISTINCT FROM prompt_brand_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'OPPORTUNITY_PROMPT_VERSION_BRAND_MISMATCH',
      DETAIL = format(
        'Opportunity.brandId=%s, Prompt.brandId=%s, promptVersionId=%s',
        NEW."brandId",
        prompt_brand_id,
        NEW."promptVersionId"
      ),
      HINT = 'Opportunity 与 PromptVersion 必须属于同一品牌';
  END IF;

  RETURN NEW;
END;
$$;

-- CreateConstraintTrigger
CREATE CONSTRAINT TRIGGER "Opportunity_promptVersion_brand_match"
AFTER INSERT OR UPDATE ON "Opportunity"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION "enforce_opportunity_prompt_version_brand_match"();
