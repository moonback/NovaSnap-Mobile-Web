/**
 * Script de test automatisé pour les corrections de données hardcodées
 * 
 * Usage:
 *   npx tsx scripts/test-hardcoded-fixes.ts
 * 
 * Prérequis:
 *   - npm install tsx @supabase/supabase-js
 *   - Variables d'environnement configurées (.env)
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Variables d\'environnement manquantes');
  console.error('   VITE_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   VITE_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Couleurs pour la console
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

// Tests
async function testDatabaseMigration() {
  log('\n📊 Test 1: Vérification de la migration DB', 'blue');
  
  try {
    // Vérifier que les colonnes latitude/longitude existent
    const { data, error } = await supabase
      .from('stories')
      .select('id, latitude, longitude')
      .limit(1);
    
    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        error('Les colonnes latitude/longitude n\'existent pas encore');
        warning('Exécutez la migration: scripts/migrations/add_gps_to_stories.sql');
        return false;
      }
      throw error;
    }
    
    success('Les colonnes GPS existent dans la table stories');
    return true;
  } catch (err) {
    error(`Erreur lors du test DB: ${err}`);
    return false;
  }
}

async function testGPSFunction() {
  log('\n🗺️  Test 2: Vérification de la fonction get_nearby_stories', 'blue');
  
  try {
    const { data, error } = await supabase.rpc('get_nearby_stories', {
      p_lat: 48.8566,
      p_lng: 2.3522,
      p_radius_km: 10.0,
      p_limit: 10,
    });
    
    if (error) {
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        error('La fonction get_nearby_stories n\'existe pas');
        warning('Exécutez la migration: scripts/migrations/add_gps_to_stories.sql');
        return false;
      }
      throw error;
    }
    
    success(`Fonction get_nearby_stories opérationnelle (${data?.length || 0} stories trouvées)`);
    return true;
  } catch (err) {
    error(`Erreur lors du test de la fonction: ${err}`);
    return false;
  }
}

async function testEdgeFunction() {
  log('\n⚡ Test 3: Vérification de l\'Edge Function delete-account', 'blue');
  
  try {
    // Test simple de disponibilité (sans authentification)
    const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // On s'attend à une erreur 401 (pas de token), pas une 404
    if (response.status === 404) {
      error('Edge Function delete-account non déployée');
      warning('Déployez la fonction: supabase functions deploy delete-account');
      return false;
    }
    
    if (response.status === 401) {
      success('Edge Function delete-account déployée et accessible');
      return true;
    }
    
    warning(`Statut inattendu: ${response.status}`);
    return false;
  } catch (err) {
    error(`Erreur lors du test de l'Edge Function: ${err}`);
    return false;
  }
}

async function testStoriesWithGPS() {
  log('\n📍 Test 4: Vérification des stories avec GPS', 'blue');
  
  try {
    const { data, error } = await supabase
      .from('stories')
      .select('id, latitude, longitude, created_at')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    const count = data?.length || 0;
    
    if (count === 0) {
      warning('Aucune story avec GPS trouvée');
      info('Créez une story avec géolocalisation activée pour tester');
      return true; // Pas une erreur, juste pas de données
    }
    
    success(`${count} stories avec GPS trouvées`);
    
    // Afficher quelques exemples
    data?.slice(0, 3).forEach((story, i) => {
      info(`  Story ${i + 1}: [${story.latitude?.toFixed(4)}, ${story.longitude?.toFixed(4)}]`);
    });
    
    return true;
  } catch (err) {
    error(`Erreur lors du test des stories GPS: ${err}`);
    return false;
  }
}

async function testCalculateDistance() {
  log('\n📏 Test 5: Vérification de la fonction calculate_distance_km', 'blue');
  
  try {
    // Test avec Paris -> Lyon (environ 400km)
    const { data, error } = await supabase.rpc('calculate_distance_km', {
      lat1: 48.8566, // Paris
      lon1: 2.3522,
      lat2: 45.7640, // Lyon
      lon2: 4.8357,
    });
    
    if (error) {
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        error('La fonction calculate_distance_km n\'existe pas');
        warning('Exécutez la migration: scripts/migrations/add_gps_to_stories.sql');
        return false;
      }
      throw error;
    }
    
    const distance = data as number;
    const expectedDistance = 400; // km approximatif
    const tolerance = 50; // km
    
    if (Math.abs(distance - expectedDistance) < tolerance) {
      success(`Fonction calculate_distance_km opérationnelle (Paris-Lyon: ${distance.toFixed(1)} km)`);
      return true;
    } else {
      warning(`Distance calculée semble incorrecte: ${distance.toFixed(1)} km (attendu ~${expectedDistance} km)`);
      return false;
    }
  } catch (err) {
    error(`Erreur lors du test de calcul de distance: ${err}`);
    return false;
  }
}

async function testStoriesView() {
  log('\n👁️  Test 6: Vérification de la vue stories_with_location', 'blue');
  
  try {
    const { data, error } = await supabase
      .from('stories_with_location')
      .select('*')
      .limit(5);
    
    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        error('La vue stories_with_location n\'existe pas');
        warning('Exécutez la migration: scripts/migrations/add_gps_to_stories.sql');
        return false;
      }
      throw error;
    }
    
    const count = data?.length || 0;
    success(`Vue stories_with_location opérationnelle (${count} stories actives avec GPS)`);
    return true;
  } catch (err) {
    error(`Erreur lors du test de la vue: ${err}`);
    return false;
  }
}

// Exécution des tests
async function runAllTests() {
  log('🧪 Démarrage des tests de validation', 'blue');
  log('═'.repeat(60), 'blue');
  
  const results = {
    dbMigration: await testDatabaseMigration(),
    gpsFunction: await testGPSFunction(),
    edgeFunction: await testEdgeFunction(),
    storiesWithGPS: await testStoriesWithGPS(),
    calculateDistance: await testCalculateDistance(),
    storiesView: await testStoriesView(),
  };
  
  log('\n' + '═'.repeat(60), 'blue');
  log('📊 Résumé des tests', 'blue');
  log('═'.repeat(60), 'blue');
  
  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(Boolean).length;
  const failed = total - passed;
  
  Object.entries(results).forEach(([name, result]) => {
    const status = result ? '✅' : '❌';
    const color = result ? 'green' : 'red';
    log(`${status} ${name}`, color);
  });
  
  log('\n' + '═'.repeat(60), 'blue');
  
  if (failed === 0) {
    success(`\n🎉 Tous les tests sont passés ! (${passed}/${total})`);
    log('\n✅ Les corrections de données hardcodées sont opérationnelles', 'green');
    process.exit(0);
  } else {
    error(`\n❌ ${failed} test(s) échoué(s) sur ${total}`);
    log('\n⚠️  Consultez DEPLOYMENT_GUIDE_HARDCODED_FIXES.md pour les instructions', 'yellow');
    process.exit(1);
  }
}

// Point d'entrée
runAllTests().catch((err) => {
  error(`\n💥 Erreur fatale: ${err}`);
  process.exit(1);
});
