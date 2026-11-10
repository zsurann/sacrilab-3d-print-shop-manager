// Configurazione dello scraper: categorie, parole chiave di ricerca e regole di vendibilità.

export const BASE = 'https://makerworld.com';
export const LOCALE = 'it';

// Categorie mostrate nell'app. `search` = ricerche eseguite su MakerWorld,
// `match` = parole (in titolo/tag) che assegnano un modello alla categoria.
export const CATEGORIES = [
  {
    key: 'casa', label: 'Casa & Organizzazione', emoji: '🏠',
    search: ['organizer', 'storage box', 'wall mount', 'hook', 'cable management', 'drawer organizer'],
    match: ['organizer', 'organiser', 'storage', 'holder', 'hook', 'hanger', 'wall mount', 'shelf', 'drawer', 'box', 'container', 'rack', 'bin', 'cable', 'clip', 'gridfinity', 'bathroom', 'toothbrush'],
  },
  {
    key: 'cucina', label: 'Cucina', emoji: '🍳',
    search: ['kitchen', 'cutting board', 'spice rack', 'bag clip', 'coffee'],
    match: ['kitchen', 'cutting', 'spice', 'coffee', 'bag clip', 'sponge', 'cup', 'mug', 'bottle', 'knife', 'jar', 'fridge', 'egg', 'utensil', 'tea', 'cookie cutter', 'pasta'],
  },
  {
    key: 'utensili', label: 'Utensili & Officina', emoji: '🛠️',
    search: ['tool', 'tool holder', 'workshop', 'screwdriver holder', 'measuring'],
    match: ['tool', 'wrench', 'screwdriver', 'drill', 'bit holder', 'workshop', 'clamp', 'vise', 'jig', 'gauge', 'measure', 'measuring', 'caliper', 'hex key', 'allen', 'plier', 'saw', 'pegboard'],
  },
  {
    key: 'gadget', label: 'Gadget utili', emoji: '💡',
    search: ['useful', 'practical', 'gadget', 'everyday carry', 'keychain'],
    match: ['useful', 'practical', 'gadget', 'edc', 'keychain', 'key holder', 'opener', 'dispenser', 'clip', 'whistle', 'carabiner'],
  },
  {
    key: 'tech', label: 'Tech & Scrivania', emoji: '🖥️',
    search: ['phone stand', 'headphone stand', 'desk organizer', 'controller holder', 'monitor'],
    match: ['phone', 'iphone', 'headphone', 'headset', 'desk', 'monitor', 'controller', 'charger', 'airpods', 'tablet', 'ipad', 'laptop', 'keyboard', 'mouse', 'usb', 'pen holder', 'switch', 'ps5', 'xbox', 'cable'],
  },
  {
    key: 'decor', label: 'Decorazione & Esposizione', emoji: '🏺',
    search: ['vase', 'lamp', 'planter', 'wall art', 'display stand', 'sculpture'],
    match: ['vase', 'lamp', 'light', 'lithophane', 'planter', 'pot', 'wall art', 'decor', 'sculpture', 'statue', 'bust', 'display', 'ornament', 'candle', 'frame', 'figurine', 'bookend', 'clock', 'shelf art'],
  },
  {
    key: 'giochi', label: 'Giochi & Fidget', emoji: '🎲',
    search: ['fidget', 'articulated', 'toy', 'puzzle', 'flexi', 'board game'],
    match: ['fidget', 'articulated', 'flexi', 'toy', 'puzzle', 'game', 'dice', 'dragon', 'spinner', 'clicker', 'gear', 'marble', 'chess', 'card holder', 'print in place', 'print-in-place'],
  },
  {
    key: 'giardino', label: 'Giardino & Esterni', emoji: '🌿',
    search: ['garden', 'plant', 'hose', 'bird feeder', 'outdoor'],
    match: ['garden', 'plant', 'hose', 'bird', 'outdoor', 'seed', 'watering', 'succulent', 'feeder', 'camping'],
  },
  {
    key: 'veicoli', label: 'Auto, Bici & Moto', emoji: '🚲',
    search: ['car accessories', 'bike', 'cup holder car', 'motorcycle'],
    match: ['car', 'auto', 'vehicle', 'bike', 'bicycle', 'cycling', 'motorcycle', 'tesla', 'dashboard', 'cup holder', 'helmet'],
  },
  {
    key: 'animali', label: 'Animali', emoji: '🐾',
    search: ['pet', 'dog', 'cat toy', 'pet feeder'],
    match: ['pet', 'dog', 'cat', 'cats', 'leash', 'paw', 'aquarium', 'feeder', 'bowl'],
  },
  {
    key: 'feste', label: 'Regali & Festività', emoji: '🎁',
    search: ['gift', 'christmas', 'halloween', 'easter', 'ornament'],
    match: ['gift', 'christmas', 'xmas', 'halloween', 'easter', 'valentine', 'birthday', 'ornament', 'santa', 'pumpkin', 'snowflake', 'advent'],
  },
];

// Pagine "di scoperta" (trend, più scaricati…) visitate oltre alle ricerche.
export const DISCOVERY_PATHS = [
  `/${LOCALE}`,
  `/${LOCALE}/3d-models`,
];

// Parole che indicano proprietà intellettuale di terzi: vendere stampe di questi modelli
// espone a contestazioni per violazione di marchio/copyright → esclusi.
export const IP_BLOCKLIST = [
  'pokemon', 'pokémon', 'pikachu', 'marvel', 'disney', 'star wars', 'mandalorian', 'baby yoda', 'grogu', 'harry potter',
  'hogwarts', 'nintendo', 'mario', 'zelda', 'sonic', 'minecraft', 'lego', 'batman', 'superman', 'spiderman', 'spider-man',
  'iron man', 'avengers', 'dc comics', 'hello kitty', 'sanrio', 'stitch', 'mickey', 'frozen', 'pixar', 'dragon ball',
  'goku', 'naruto', 'one piece', 'demon slayer', 'jujutsu', 'genshin', 'warhammer', 'games workshop', 'lord of the rings',
  'ferrari', 'lamborghini', 'porsche', 'bmw', 'mercedes', 'nike', 'adidas', 'supreme', 'louis vuitton', 'gucci',
  'chanel', 'apple logo', 'tesla logo', 'nfl', 'nba', 'fifa', 'formula 1', 'f1', 'stranger things', 'squid game',
  'transformers', 'godzilla', 'shrek', 'simpsons', 'spongebob', 'among us', 'fortnite', 'roblox', 'bluey', 'paw patrol',
];

// Parole che rendono un modello poco adatto alla vendita (file di test, parti di ricambio
// per stampanti, upgrade, modelli per adulti, armi, ecc.).
export const LOW_SELLABILITY = [
  'calibration', 'benchy', 'test print', 'tolerance test', 'bambu lab', 'ams', 'x1c', 'p1s', 'p1p', 'a1 mini',
  'a1m', 'printer', 'nozzle', 'extruder', 'spool', 'filament', 'hotend', 'purge', 'poop', 'gun', 'pistol', 'rifle',
  'weapon', 'knife blade', 'nsfw', 'sexy', 'nude', 'replacement part', 'spare part', 'mod for', 'upgrade kit',
];

// Parole che aumentano la vendibilità (utili, regalo, print-in-place, nessun supporto…).
export const HIGH_SELLABILITY = [
  { words: ['print in place', 'print-in-place', 'no support', 'no supports', 'supportless'], bonus: 6, reason: 'Stampa facile' },
  { words: ['articulated', 'flexi', 'fidget'], bonus: 5, reason: 'Tendenza' },
  { words: ['gift', 'regalo', 'christmas', 'personalized', 'custom name'], bonus: 4, reason: 'Ottimo regalo' },
  { words: ['organizer', 'holder', 'stand', 'storage', 'hook', 'mount'], bonus: 4, reason: 'Utile ogni giorno' },
  { words: ['lamp', 'vase', 'planter', 'lithophane'], bonus: 4, reason: 'Da esposizione' },
  { words: ['kitchen', 'bathroom', 'desk', 'office'], bonus: 3, reason: 'Casa & ufficio' },
];

export const LIMITS = {
  scrollsPerPage: 4,        // quante volte scorrere ogni pagina per caricare altri risultati
  perCategory: 14,          // modelli massimi per categoria
  total: 140,               // modelli massimi nel catalogo
  minDownloads: 150,        // soglia minima di popolarità
  allowNonCommercial: false // escludi modelli con licenza "NonCommercial"
};
