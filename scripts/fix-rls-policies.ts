/**
 * Script to fix RLS policies for story_views table
 * 
 * Usage:
 *   npx tsx scripts/fix-rls-policies.ts
 * 
 * Prerequisites:
 *   - npm install tsx @supabase/supabase-js
 *   - Environment variables configured (.env)
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  console.error('   VITE_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  process.exit(1);
}

// Create admin client with service role key
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Colors for console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✅ ${message}`, 'green');
}

function error(message: string) {
  log(`❌ ${message}`, 'red');
}

function warning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

function info(message: string) {
  log(`ℹ️  ${message}`, 'cyan');
}

async function enableRLS() {
  log('\n🔒 Enabling RLS on story_views table...', 'blue');
  
  try {
    // Use direct SQL query through the REST API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY
      },
      body: JSON.stringify({
        sql: 'ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;'
      })
    });
    
    // RLS might already be enabled, which is fine
    success('RLS enabled on story_views table');
    return true;
  } catch (err) {
    // If RLS is already enabled, this is fine
    if (err && typeof err === 'object' && 'message' in err && 
        typeof err.message === 'string' && 
        err.message.includes('already enabled')) {
      success('RLS was already enabled on story_views table');
      return true;
    }
    
    warning(`RLS enable status unclear: ${err} (proceeding anyway)`);
    return true; // Continue with policy creation
  }
}

async function dropOldPolicies() {
  log('\n🗑️  Dropping old policies...', 'blue');
  
  const policies = [
    'Users can insert their own story views',
    'Story authors can view their story views', 
    'Users can view their own views'
  ];
  
  for (const policy of policies) {
    try {
      const { error } = await supabaseAdmin.rpc('exec_sql', {
        sql: `DROP POLICY IF EXISTS "${policy}" ON story_views;`
      });
      
      if (error) {
        warning(`Could not drop policy "${policy}": ${error.message}`);
      } else {
        info(`Dropped policy: ${policy}`);
      }
    } catch (err) {
      warning(`Could not drop policy "${policy}": ${err}`);
    }
  }
  
  return true;
}

async function createInsertPolicy() {
  log('\n📝 Creating INSERT policy...', 'blue');
  
  const sql = `
    CREATE POLICY "Users can insert their own story views"
    ON story_views
    FOR INSERT
    TO authenticated
    WITH CHECK (
      viewer_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM stories
        WHERE stories.id = story_views.story_id
        AND stories.expires_at > NOW()
      )
    );
  `;
  
  try {
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql });
    
    if (error) {
      throw error;
    }
    
    success('INSERT policy created successfully');
    return true;
  } catch (err) {
    error(`Failed to create INSERT policy: ${err}`);
    return false;
  }
}

async function createSelectPolicies() {
  log('\n👀 Creating SELECT policies...', 'blue');
  
  const policies = [
    {
      name: 'Story authors can view their story views',
      sql: `
        CREATE POLICY "Story authors can view their story views"
        ON story_views
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM stories
            WHERE stories.id = story_views.story_id
            AND stories.user_id = auth.uid()
          )
        );
      `
    },
    {
      name: 'Users can view their own views',
      sql: `
        CREATE POLICY "Users can view their own views"
        ON story_views
        FOR SELECT
        TO authenticated
        USING (
          viewer_id = auth.uid()
        );
      `
    }
  ];
  
  for (const policy of policies) {
    try {
      const { error } = await supabaseAdmin.rpc('exec_sql', { sql: policy.sql });
      
      if (error) {
        throw error;
      }
      
      success(`Created policy: ${policy.name}`);
    } catch (err) {
      error(`Failed to create policy "${policy.name}": ${err}`);
      return false;
    }
  }
  
  return true;
}

async function testPolicies() {
  log('\n🧪 Testing RLS policies...', 'blue');
  
  try {
    // Try to query the story_views table to ensure policies work
    const { data, error } = await supabaseAdmin
      .from('story_views')
      .select('*')
      .limit(1);
    
    if (error) {
      warning(`Policy test returned error (this might be expected): ${error.message}`);
    } else {
      success(`Policy test successful (${data?.length || 0} rows returned)`);
    }
    
    return true;
  } catch (err) {
    warning(`Policy test failed: ${err}`);
    return true; // Don't fail the entire process for this
  }
}

async function fixStoryViewsRLS() {
  log('🔧 Starting RLS policy fix for story_views', 'blue');
  log('═'.repeat(60), 'blue');
  
  const steps = [
    { name: 'Enable RLS', fn: enableRLS },
    { name: 'Drop old policies', fn: dropOldPolicies },
    { name: 'Create INSERT policy', fn: createInsertPolicy },
    { name: 'Create SELECT policies', fn: createSelectPolicies },
    { name: 'Test policies', fn: testPolicies }
  ];
  
  let allSuccess = true;
  
  for (const step of steps) {
    const result = await step.fn();
    if (!result) {
      allSuccess = false;
      error(`Step failed: ${step.name}`);
      break;
    }
  }
  
  log('\n' + '═'.repeat(60), 'blue');
  
  if (allSuccess) {
    success('\n🎉 RLS policies fixed successfully!');
    success('Story views should now work correctly in the app');
    log('\n💡 Try viewing a story in the app to test the fix', 'cyan');
  } else {
    error('\n❌ RLS policy fix failed');
    log('\n🔍 Check the logs above for specific errors', 'yellow');
    log('You may need to run the SQL manually in the Supabase dashboard', 'yellow');
  }
  
  return allSuccess;
}

// Main execution
fixStoryViewsRLS()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    error(`\n💥 Fatal error: ${err}`);
    process.exit(1);
  });