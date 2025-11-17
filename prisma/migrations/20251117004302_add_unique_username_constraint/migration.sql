-- Handle existing duplicate usernames (case-insensitive)
-- For duplicates, append a number suffix to make them unique
DO $$
DECLARE
  profile_record RECORD;
  counter INTEGER;
  new_name TEXT;
BEGIN
  -- Find profiles with duplicate names (case-insensitive)
  FOR profile_record IN
    SELECT p1.id, p1.name, p1.email
    FROM "Profile" p1
    WHERE EXISTS (
      SELECT 1
      FROM "Profile" p2
      WHERE LOWER(p2.name) = LOWER(p1.name)
        AND p2.id != p1.id
        AND p2.id < p1.id  -- Only process the "later" duplicate
    )
    ORDER BY LOWER(name), id
  LOOP
    counter := 1;
    new_name := profile_record.name || counter::TEXT;
    
    -- Keep incrementing until we find a unique name
    WHILE EXISTS (
      SELECT 1
      FROM "Profile"
      WHERE LOWER(name) = LOWER(new_name)
        AND id != profile_record.id
    ) LOOP
      counter := counter + 1;
      new_name := profile_record.name || counter::TEXT;
    END LOOP;
    
    -- Update the profile with the new unique name
    UPDATE "Profile"
    SET name = new_name
    WHERE id = profile_record.id;
  END LOOP;
END $$;

-- Create a unique index on LOWER(name) for case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS "Profile_name_lower_unique" 
ON "Profile" (LOWER(name));
