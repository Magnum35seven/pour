/* TheCocktailDB API wrapper with caching */
const API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1';
const cache = new Map();

async function request(url) {
  const key = url;
  if (cache.has(key)) return cache.get(key);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    cache.set(key, json);
    return json;
  } catch (e) {
    console.error('CocktailDB request failed:', e);
    return null;
  }
}

function normaliseDrink(drink) {
  const ingredients = [];
  for (let i = 1; i <= 15; i++) {
    const name = drink[`strIngredient${i}`];
    if (!name) continue;
    ingredients.push({
      name,
      measure: drink[`strMeasure${i}`] || ''
    });
  }

  return {
    id: drink.idDrink,
    name: drink.strDrink,
    thumb: drink.strDrinkThumb || '',
    category: drink.strCategory || '',
    glass: drink.strGlass || '',
    alcoholic: drink.strAlcoholic || '',
    instructions: drink.strInstructions || '',
    ingredients,
    tags: drink.strTags || ''
  };
}

export async function searchCocktails(query) {
  const term = (query || '').trim();
  if (!term) return [];
  const json = await request(`${API_BASE}/search.php?s=${encodeURIComponent(term)}`);
  return json && json.drinks ? json.drinks.map(normaliseDrink) : [];
}

export async function filterByIngredient(name) {
  const term = (name || '').trim();
  if (!term) return [];
  const json = await request(`${API_BASE}/filter.php?i=${encodeURIComponent(term)}`);
  return json && json.drinks ? json.drinks.map(d => ({
    id: d.idDrink,
    name: d.strDrink,
    thumb: d.strDrinkThumb || ''
  })) : [];
}

export async function filterByCategory(name) {
  const term = (name || '').trim();
  if (!term) return [];
  const json = await request(`${API_BASE}/filter.php?c=${encodeURIComponent(term)}`);
  return json && json.drinks ? json.drinks.map(d => ({
    id: d.idDrink,
    name: d.strDrink,
    thumb: d.strDrinkThumb || ''
  })) : [];
}

export async function filterByGlass(name) {
  const term = (name || '').trim();
  if (!term) return [];
  const json = await request(`${API_BASE}/filter.php?g=${encodeURIComponent(term)}`);
  return json && json.drinks ? json.drinks.map(d => ({
    id: d.idDrink,
    name: d.strDrink,
    thumb: d.strDrinkThumb || ''
  })) : [];
}

export async function listCategories() {
  const json = await request(`${API_BASE}/list.php?c=list`);
  return json && json.drinks ? json.drinks.map(d => d.strCategory).filter(Boolean) : [];
}

export async function listGlasses() {
  const json = await request(`${API_BASE}/list.php?g=list`);
  return json && json.drinks ? json.drinks.map(d => d.strGlass).filter(Boolean) : [];
}

export async function randomCocktail() {
  const json = await request(`${API_BASE}/random.php`);
  return json && json.drinks && json.drinks[0] ? [normaliseDrink(json.drinks[0])] : [];
}

export async function lookupDrink(id) {
  const json = await request(`${API_BASE}/lookup.php?i=${encodeURIComponent(id)}`);
  return json && json.drinks && json.drinks[0] ? normaliseDrink(json.drinks[0]) : null;
}
