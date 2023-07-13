const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL) {
  throw new Error("Missing SUPABASE_UR");
}

if (!process.env.SUPABASE_PRIVATE_KEY) {
  throw new Error("Missing SUPABASE_PRIVATE_KEY");
}

/*
	paso eso a module.exports para poder usarlo en otro archivo
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PRIVATE_KEY
);*/ 

const supabase = createClient(

		process.env.SUPABASE_URL,
		process.env.SUPABASE_PRIVATE_KEY
	);

module.exports = supabase;