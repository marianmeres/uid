const Scheduler = (()=>{
    const queues = {
        microtask: {
            map: new Map(),
            scheduled: false,
            arm: (cb)=>queueMicrotask(cb)
        },
        raf: {
            map: new Map(),
            scheduled: false,
            arm: (cb)=>requestAnimationFrame(cb)
        }
    };
    let flushing = false;
    let chainDepth = 0;
    function flush(kind) {
        const q = queues[kind];
        const entries = q.map;
        q.map = new Map();
        q.scheduled = false;
        flushing = true;
        try {
            entries.forEach((read, fn)=>fn(read()));
        } finally{
            flushing = false;
        }
    }
    function enqueue(fn, kind, read) {
        const q = queues[kind] ?? queues.microtask;
        const arming = !q.scheduled;
        if (arming) {
            if (flushing) {
                if (++chainDepth > 1000) {
                    chainDepth = 0;
                    throw new Error(`vanilla: maximum update depth exceeded (${1000}) — ` + `likely a feedback loop where an effect's set() retriggers ` + `itself (a writes b, b writes a, …). Check your reactTo/computed ` + `wiring, or make the loop converge so the equality guard can ` + `stop it.`);
                }
            } else {
                chainDepth = 0;
            }
        }
        q.map.set(fn, read);
        if (arming) {
            q.scheduled = true;
            q.arm(()=>flush(kind));
        }
    }
    return {
        enqueue
    };
})();
let computing = 0;
function observable(value) {
    const subs = new Map();
    function notify() {
        subs.forEach((kind, fn)=>Scheduler.enqueue(fn, kind, ()=>value));
    }
    const self = {
        get: ()=>value,
        set (v) {
            if (computing > 0) {
                throw new Error("vanilla: cannot set() an observable from inside a computed's " + "calc — calc must be a pure derivation of its sources (no writes " + "/ side effects). Move the write into a reactTo(...) effect.");
            }
            if (v === value) return;
            value = v;
            notify();
        },
        update (fn) {
            self.set(fn(value));
        },
        subscribe (fn, { immediate = true, scheduler = "microtask" } = {}) {
            subs.set(fn, scheduler);
            if (immediate) fn(value);
            return ()=>{
                subs.delete(fn);
            };
        }
    };
    return self;
}
function fromTemplate(id) {
    const tpl = document.getElementById(id);
    if (!tpl) throw new Error(`Template not found: #${id}`);
    const first = tpl.content.firstElementChild;
    if (!first) throw new Error(`Template #${id} has no element content`);
    return first.cloneNode(true);
}
function refs(root) {
    const map = {};
    const self = root;
    if (self.matches?.("[data-ref]")) map[self.dataset.ref] = self;
    root.querySelectorAll("[data-ref]").forEach((el)=>{
        map[el.dataset.ref] = el;
    });
    return map;
}
const BIND_ALIAS = {
    text: "textContent",
    html: "innerHTML",
    class: "className"
};
function applyBindings(root, data) {
    const targets = [
        ...root.matches?.("[data-bind]") ? [
            root
        ] : [],
        ...root.querySelectorAll("[data-bind]")
    ];
    targets.forEach((el)=>{
        el.dataset.bind.split(";").forEach((rule)=>{
            const [kind, field] = rule.split(":").map((s)=>s.trim());
            if (!kind) return;
            const prop = BIND_ALIAS[kind] ?? kind;
            el[prop] = data[field];
        });
    });
}
function tracker() {
    const cleanups = [];
    return {
        track: (unsub)=>{
            cleanups.push(unsub);
            return unsub;
        },
        dispose: ()=>{
            cleanups.forEach((fn)=>fn());
            cleanups.length = 0;
        }
    };
}
function createView(mountFn) {
    const { track, dispose } = tracker();
    const api = mountFn(track) ?? {};
    return {
        ...api,
        destroy () {
            dispose();
            api.el?.remove();
        }
    };
}
function delegate(root, handlers) {
    const seen = new Set();
    const collect = (scope)=>scope.querySelectorAll("[data-on]").forEach((el)=>el.dataset.on.split(";").forEach((r)=>seen.add(r.split(":")[0].trim())));
    collect(root);
    document.querySelectorAll("template").forEach((t)=>collect(t.content));
    const unsubs = [];
    seen.forEach((evt)=>{
        const listener = (e)=>{
            const el = e.target?.closest("[data-on]");
            if (!el || !root.contains(el)) return;
            el.dataset.on.split(";").forEach((rule)=>{
                const [type, action] = rule.split(":").map((s)=>s.trim());
                if (type === evt && handlers[action]) handlers[action](e, el);
            });
        };
        root.addEventListener(evt, listener);
        unsubs.push(()=>root.removeEventListener(evt, listener));
    });
    return ()=>unsubs.forEach((u)=>u());
}
new Map();
new Map();
const ALPHABETS = {
    hex: "0123456789abcdef",
    base32: "0123456789ABCDEFGHJKMNPQRSTVWXYZ",
    base36: "0123456789abcdefghijklmnopqrstuvwxyz",
    base56: "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz",
    base58: "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
    base62: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    numeric: "0123456789",
    alphanumeric: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    nanoid: "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz"
};
function assertPositiveInt(n, label) {
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1) {
        throw new TypeError(`"${label}" must be a positive integer, got ${String(n)}`);
    }
}
function assertNonNegativeInt(n, label) {
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
        throw new TypeError(`"${label}" must be a non-negative integer, got ${String(n)}`);
    }
}
function randomBytes(size) {
    assertPositiveInt(size, "size");
    const bytes = new Uint8Array(size);
    const MAX = 65536;
    for(let offset = 0; offset < size; offset += MAX){
        crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + 65536, size)));
    }
    return bytes;
}
function randomString(length, alphabet = ALPHABETS.nanoid) {
    assertPositiveInt(length, "length");
    if (typeof alphabet !== "string") {
        throw new TypeError(`"alphabet" must be a string, got ${typeof alphabet}`);
    }
    const alen = alphabet.length;
    if (alen < 1 || alen > 256) {
        throw new RangeError(`"alphabet" length must be between 1 and 256, got ${alen}`);
    }
    if (alen === 1) return alphabet.repeat(length);
    const mask = (2 << Math.floor(Math.log2(alen - 1))) - 1;
    const step = Math.ceil(1.6 * mask * length / alen);
    let id = "";
    while(true){
        const bytes = randomBytes(step);
        for(let i = 0; i < step; i++){
            const idx = bytes[i] & mask;
            if (idx < alen) {
                id += alphabet[idx];
                if (id.length === length) return id;
            }
        }
    }
}
function bytesToUuid(bytes) {
    let h = "";
    for(let i = 0; i < 16; i++)h += bytes[i].toString(16).padStart(2, "0");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function uuid() {
    return crypto.randomUUID();
}
function uuidv7(timestamp = Date.now()) {
    const ts = Math.floor(timestamp);
    if (!Number.isFinite(ts) || ts < 0 || ts > 0xffffffffffff) {
        throw new RangeError(`uuidv7: timestamp must be in [0, 2^48), got ${String(timestamp)}`);
    }
    const bytes = randomBytes(16);
    bytes[0] = Math.floor(ts / 2 ** 40) & 0xff;
    bytes[1] = Math.floor(ts / 2 ** 32) & 0xff;
    bytes[2] = Math.floor(ts / 2 ** 24) & 0xff;
    bytes[3] = Math.floor(ts / 2 ** 16) & 0xff;
    bytes[4] = Math.floor(ts / 2 ** 8) & 0xff;
    bytes[5] = ts & 0xff;
    bytes[6] = bytes[6] & 0x0f | 0x70;
    bytes[8] = bytes[8] & 0x3f | 0x80;
    return bytesToUuid(bytes);
}
function ulid(timestamp = Date.now()) {
    const ts = Math.floor(timestamp);
    if (!Number.isFinite(ts) || ts < 0 || ts > 0xffffffffffff) {
        throw new RangeError(`ulid: timestamp must be in [0, 2^48), got ${String(timestamp)}`);
    }
    const enc = ALPHABETS.base32;
    let time = ts;
    let timeChars = "";
    for(let i = 0; i < 10; i++){
        timeChars = enc[time % 32] + timeChars;
        time = Math.floor(time / 32);
    }
    return timeChars + randomString(16, enc);
}
const BASE56 = ALPHABETS.base56;
function base56(length = 21) {
    return randomString(length, BASE56);
}
function uuidToBase56(uuid) {
    const hex = uuid.replace(/-/g, "").toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(hex)) {
        throw new TypeError(`uuidToBase56: invalid uuid "${uuid}"`);
    }
    let num = BigInt("0x" + hex);
    let result = "";
    while(num > 0n){
        result = BASE56[Number(num % 56n)] + result;
        num = num / 56n;
    }
    return result.padStart(23, BASE56[0]);
}
function base56ToUuid(encoded) {
    let num = 0n;
    for (const ch of encoded){
        const idx = BASE56.indexOf(ch);
        if (idx < 0) {
            throw new Error(`base56ToUuid: invalid character "${ch}"`);
        }
        num = num * 56n + BigInt(idx);
    }
    const hex = num.toString(16).padStart(32, "0");
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20)
    ].join("-");
}
function nanoid(length = 21, alphabet = ALPHABETS.nanoid) {
    return randomString(length, alphabet);
}
function hex(length = 21) {
    return randomString(length, ALPHABETS.hex);
}
function base32(length = 21) {
    return randomString(length, ALPHABETS.base32);
}
function base36(length = 21) {
    return randomString(length, ALPHABETS.base36);
}
function base58(length = 21) {
    return randomString(length, ALPHABETS.base58);
}
function base62(length = 21) {
    return randomString(length, ALPHABETS.base62);
}
function numeric(length = 21) {
    return randomString(length, ALPHABETS.numeric);
}
function validate(o) {
    const { prefix = "", start = 0, step = 1, pad = 0 } = o;
    if (typeof prefix !== "string") {
        throw new TypeError(`counter: "prefix" must be a string`);
    }
    if (!Number.isInteger(start)) {
        throw new TypeError(`counter: "start" must be an integer`);
    }
    if (!Number.isInteger(step) || step < 1) {
        throw new TypeError(`counter: "step" must be a positive integer`);
    }
    assertNonNegativeInt(pad, "pad");
    return {
        prefix,
        start,
        step,
        pad
    };
}
function format(prefix, n, pad) {
    const s = pad > 0 ? String(n).padStart(pad, "0") : String(n);
    return prefix + s;
}
const _counters = new Map();
function counter(options = {}) {
    const { prefix, start, step, pad } = validate(options);
    const existing = _counters.get(prefix);
    const entry = existing ? {
        ...existing,
        value: existing.value + existing.step
    } : {
        value: start,
        step,
        pad
    };
    _counters.set(prefix, entry);
    return format(prefix, entry.value, entry.pad);
}
function resetCounters(prefix) {
    if (prefix === undefined) _counters.clear();
    else _counters.delete(prefix);
}
function consistentShuffle(alphabet, salt) {
    if (!salt.length) return alphabet;
    const a = alphabet.split("");
    for(let i = a.length - 1, v = 0, p = 0; i > 0; i--, v++){
        v %= salt.length;
        const __int = salt.charCodeAt(v);
        p += __int;
        const j = (__int + v + p) % i;
        const tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    return a.join("");
}
function assertReversibleAlphabet(alphabet, fn) {
    if (alphabet.length < 2) {
        throw new RangeError(`${fn}: "alphabet" needs at least 2 characters`);
    }
    if (new Set(alphabet).size !== alphabet.length) {
        throw new RangeError(`${fn}: "alphabet" must have unique characters`);
    }
}
function encodeInt(value, options = {}) {
    const { alphabet = ALPHABETS.base62, salt = "", minLength = 0 } = options;
    if (!Number.isInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
        throw new RangeError(`encodeInt: value must be a safe non-negative integer, got ${String(value)}`);
    }
    assertReversibleAlphabet(alphabet, "encodeInt");
    const a = consistentShuffle(alphabet, salt);
    const base = a.length;
    let n = value;
    let out = "";
    do {
        out = a[n % base] + out;
        n = Math.floor(n / base);
    }while (n > 0)
    while(out.length < minLength)out = a[0] + out;
    return out;
}
function decodeInt(str, options = {}) {
    const { alphabet = ALPHABETS.base62, salt = "" } = options;
    assertReversibleAlphabet(alphabet, "decodeInt");
    const a = consistentShuffle(alphabet, salt);
    const base = a.length;
    let n = 0;
    for (const ch of str){
        const idx = a.indexOf(ch);
        if (idx < 0) throw new Error(`decodeInt: invalid character "${ch}"`);
        n = n * base + idx;
        if (n > Number.MAX_SAFE_INTEGER) {
            throw new RangeError(`decodeInt: decoded value exceeds safe integer range`);
        }
    }
    return n;
}
const _registry = new Map();
function registerStrategy(name, fn) {
    if (typeof name !== "string" || !name) {
        throw new TypeError(`registerStrategy: "name" must be a non-empty string`);
    }
    if (typeof fn !== "function") {
        throw new TypeError(`registerStrategy: "fn" must be a function`);
    }
    _registry.set(name, fn);
}
function listStrategies() {
    return [
        ..._registry.keys()
    ];
}
registerStrategy("uuid", ()=>uuid());
registerStrategy("uuidv4", ()=>uuid());
registerStrategy("uuidv7", (o = {})=>uuidv7(o.timestamp));
registerStrategy("ulid", (o = {})=>ulid(o.timestamp));
registerStrategy("base56", (o = {})=>{
    const { uuid: u, length } = o;
    return u != null ? uuidToBase56(u) : base56(length);
});
registerStrategy("nanoid", (o = {})=>{
    const { length, alphabet } = o;
    return nanoid(length, alphabet);
});
registerStrategy("hex", (o = {})=>hex(o.length));
registerStrategy("base32", (o = {})=>base32(o.length));
registerStrategy("base36", (o = {})=>base36(o.length));
registerStrategy("base58", (o = {})=>base58(o.length));
registerStrategy("base62", (o = {})=>base62(o.length));
registerStrategy("numeric", (o = {})=>numeric(o.length));
registerStrategy("custom", (o = {})=>{
    const { alphabet, length } = o;
    if (typeof alphabet !== "string") {
        throw new TypeError(`uid("custom"): "alphabet" option is required`);
    }
    return randomString(length ?? 21, alphabet);
});
registerStrategy("counter", (o = {})=>counter(o));
registerStrategy("reversible", (o = {})=>{
    const { value, ...rest } = o;
    if (typeof value !== "number") {
        throw new TypeError(`uid("reversible"): "value" option is required`);
    }
    return encodeInt(value, rest);
});
function uid(strategy = "uuid", options = {}) {
    const fn = _registry.get(strategy);
    if (!fn) {
        if (strategy === "rhr") {
            throw new Error(`The "rhr" strategy is opt-in. Enable it once with:\n` + `  import "@marianmeres/uid/rhr";\n` + `(or use the named export: import { rhr } from "@marianmeres/uid/rhr")`);
        }
        throw new Error(`Unknown uid strategy "${strategy}". Available: ${listStrategies().join(", ")}`);
    }
    return fn(options);
}
const adjs = [
    "light",
    "dark",
    "dim",
    "pale",
    "attractive",
    "bald",
    "beautiful",
    "chubby",
    "clean",
    "dazzling",
    "drab",
    "elegant",
    "fancy",
    "fit",
    "flabby",
    "glamorous",
    "gorgeous",
    "handsome",
    "long",
    "magnificent",
    "muscular",
    "plain",
    "plump",
    "quaint",
    "scruffy",
    "shapely",
    "short",
    "skinny",
    "stocky",
    "ugly",
    "unkempt",
    "unsightly",
    "alive",
    "better",
    "careful",
    "clever",
    "dead",
    "easy",
    "famous",
    "gifted",
    "hallowed",
    "helpful",
    "important",
    "inexpensive",
    "mealy",
    "mushy",
    "odd",
    "poor",
    "powerful",
    "rich",
    "shy",
    "tender",
    "vast",
    "wrong",
    "aggressive",
    "agreeable",
    "ambitious",
    "brave",
    "calm",
    "delightful",
    "eager",
    "faithful",
    "gentle",
    "happy",
    "jolly",
    "kind",
    "lively",
    "nice",
    "obedient",
    "polite",
    "proud",
    "silly",
    "thankful",
    "victorious",
    "witty",
    "wonderful",
    "zealous",
    "angry",
    "bewildered",
    "clumsy",
    "defeated",
    "fierce",
    "grumpy",
    "helpless",
    "itchy",
    "jealous",
    "lazy",
    "mysterious",
    "nervous",
    "obnoxious",
    "panicky",
    "pitiful",
    "repulsive",
    "scary",
    "thoughtless",
    "uptight",
    "worried",
    "broad",
    "crooked",
    "curved",
    "deep",
    "flat",
    "high",
    "hollow",
    "low",
    "narrow",
    "refined",
    "round",
    "shallow",
    "square",
    "steep",
    "straight",
    "wide",
    "big",
    "colossal",
    "fat",
    "gigantic",
    "great",
    "huge",
    "immense",
    "large",
    "little",
    "mammoth",
    "massive",
    "microscopic",
    "miniature",
    "petite",
    "puny",
    "scrawny",
    "small",
    "tall",
    "teeny",
    "tiny",
    "crashing",
    "deafening",
    "echoing",
    "faint",
    "harsh",
    "hissing",
    "howling",
    "loud",
    "melodic",
    "noisy",
    "purring",
    "quiet",
    "rapping",
    "raspy",
    "rhythmic",
    "screeching",
    "shrilling",
    "squeaking",
    "thundering",
    "tinkling",
    "wailing",
    "whining",
    "whispering",
    "ancient",
    "brief",
    "early",
    "fast",
    "future",
    "late",
    "modern",
    "old",
    "prehistoric",
    "quick",
    "rapid",
    "slow",
    "swift",
    "young",
    "acidic",
    "bitter",
    "cool",
    "creamy",
    "delicious",
    "disgusting",
    "fresh",
    "greasy",
    "juicy",
    "hot",
    "moldy",
    "nutritious",
    "nutty",
    "putrid",
    "rancid",
    "ripe",
    "rotten",
    "salty",
    "savory",
    "sour",
    "spicy",
    "spoiled",
    "stale",
    "sweet",
    "tangy",
    "tart",
    "tasteless",
    "tasty",
    "yummy",
    "breezy",
    "bumpy",
    "chilly",
    "cold",
    "cuddly",
    "damaged",
    "damp",
    "dirty",
    "dry",
    "flaky",
    "fluffy",
    "freezing",
    "icy",
    "loose",
    "melted",
    "prickly",
    "rough",
    "shaggy",
    "sharp",
    "slimy",
    "sticky",
    "strong",
    "tight",
    "uneven",
    "warm",
    "weak",
    "wet",
    "wooden",
    "abundant",
    "billions",
    "enough",
    "few",
    "full",
    "hundreds",
    "incalculable",
    "limited",
    "many",
    "most",
    "millions",
    "numerous",
    "scarce",
    "some",
    "sparse",
    "substantial",
    "thousands"
];
const nouns = [
    "government",
    "literature",
    "television",
    "investment",
    "definition",
    "management",
    "technology",
    "university",
    "department",
    "difference",
    "philosophy",
    "population",
    "appearance",
    "discussion",
    "expression",
    "importance",
    "foundation",
    "collection",
    "depression",
    "percentage",
    "connection",
    "psychology",
    "membership",
    "possession",
    "employment",
    "preference",
    "difficulty",
    "protection",
    "suggestion",
    "atmosphere",
    "comparison",
    "leadership",
    "efficiency",
    "excitement",
    "permission",
    "reflection",
    "resolution",
    "initiative",
    "restaurant",
    "assumption",
    "enthusiasm",
    "perception",
    "revolution",
    "assistance",
    "conclusion",
    "impression",
    "inspection",
    "profession",
    "assignment",
    "friendship",
    "girlfriend",
    "indication",
    "obligation",
    "reputation",
    "experience",
    "discipline",
    "background",
    "commission",
    "confidence",
    "conference",
    "transition",
    "specialist",
    "particular",
    "individual",
    "commercial",
    "equivalent",
    "inevitable",
    "knowledge",
    "economics",
    "community",
    "equipment",
    "boyfriend",
    "direction",
    "marketing",
    "chemistry",
    "apartment",
    "education",
    "attention",
    "president",
    "cigarette",
    "newspaper",
    "inflation",
    "insurance",
    "situation",
    "statement",
    "criticism",
    "secretary",
    "selection",
    "complaint",
    "agreement",
    "tradition",
    "classroom",
    "variation",
    "awareness",
    "candidate",
    "confusion",
    "operation",
    "recording",
    "promotion",
    "childhood",
    "procedure",
    "signature",
    "committee",
    "historian",
    "reception",
    "chocolate",
    "inspector",
    "professor",
    "assistant",
    "departure",
    "intention",
    "passenger",
    "pollution",
    "beginning",
    "advantage",
    "structure",
    "condition",
    "challenge",
    "influence",
    "reference",
    "character",
    "vegetable",
    "principle",
    "breakfast",
    "substance",
    "afternoon",
    "interview",
    "guarantee",
    "implement",
    "telephone",
    "dimension",
    "emergency",
    "extension",
    "associate",
    "landscape",
    "highlight",
    "potential",
    "following",
    "necessary",
    "effective",
    "beautiful",
    "objective",
    "somewhere",
    "sensitive",
    "spiritual",
    "dependent",
    "brilliant",
    "temporary",
    "yesterday",
    "computer",
    "software",
    "internet",
    "activity",
    "industry",
    "language",
    "security",
    "analysis",
    "strategy",
    "instance",
    "audience",
    "marriage",
    "medicine",
    "location",
    "addition",
    "painting",
    "politics",
    "decision",
    "property",
    "shopping",
    "category",
    "magazine",
    "teaching",
    "customer",
    "resource",
    "patience",
    "solution",
    "attitude",
    "director",
    "response",
    "argument",
    "contract",
    "emphasis",
    "currency",
    "republic",
    "delivery",
    "election",
    "football",
    "guidance",
    "priority",
    "elevator",
    "employee",
    "employer",
    "disaster",
    "feedback",
    "homework",
    "judgment",
    "relation",
    "accident",
    "baseball",
    "database",
    "hospital",
    "presence",
    "proposal",
    "quantity",
    "reaction",
    "weakness",
    "ambition",
    "bathroom",
    "birthday",
    "midnight",
    "platform",
    "stranger",
    "sympathy",
    "business",
    "interest",
    "training",
    "practice",
    "research",
    "exercise",
    "building",
    "material",
    "question",
    "standard",
    "exchange",
    "position",
    "pressure",
    "function",
    "distance",
    "discount",
    "register",
    "campaign",
    "evidence",
    "strength",
    "relative",
    "progress",
    "daughter",
    "pleasure",
    "calendar",
    "district",
    "schedule",
    "swimming",
    "designer",
    "mountain",
    "occasion",
    "sentence",
    "shoulder",
    "vacation",
    "document",
    "mortgage",
    "sandwich",
    "surprise",
    "champion",
    "engineer",
    "entrance",
    "incident",
    "resident",
    "specific",
    "possible",
    "personal",
    "national",
    "physical",
    "increase",
    "purchase",
    "positive",
    "creative",
    "original",
    "negative",
    "anything",
    "familiar",
    "official",
    "valuable",
    "chemical",
    "conflict",
    "opposite",
    "anywhere",
    "internal",
    "constant",
    "external",
    "ordinary",
    "struggle",
    "upstairs",
    "estimate",
    "surround",
    "tomorrow",
    "history",
    "reading",
    "problem",
    "control",
    "ability",
    "science",
    "library",
    "product",
    "society",
    "quality",
    "variety",
    "country",
    "physics",
    "thought",
    "freedom",
    "writing",
    "article",
    "fishing",
    "failure",
    "meaning",
    "teacher",
    "disease",
    "success",
    "student",
    "context",
    "finding",
    "message",
    "concept",
    "housing",
    "opinion",
    "payment",
    "reality",
    "passion",
    "setting",
    "college",
    "storage",
    "version",
    "alcohol",
    "highway",
    "mixture",
    "tension",
    "anxiety",
    "climate",
    "emotion",
    "manager",
    "charity",
    "outcome",
    "revenue",
    "session",
    "cabinet",
    "clothes",
    "drawing",
    "hearing",
    "vehicle",
    "airport",
    "arrival",
    "chapter",
    "village",
    "warning",
    "courage",
    "garbage",
    "grocery",
    "penalty",
    "wedding",
    "analyst",
    "bedroom",
    "diamond",
    "fortune",
    "funeral",
    "speaker",
    "surgery",
    "trainer",
    "example",
    "process",
    "economy",
    "company",
    "service",
    "picture",
    "section",
    "nothing",
    "subject",
    "weather",
    "program",
    "chicken",
    "feature",
    "purpose",
    "outside",
    "benefit",
    "account",
    "balance",
    "machine",
    "address",
    "average",
    "culture",
    "morning",
    "contact",
    "network",
    "attempt",
    "capital",
    "plastic",
    "feeling",
    "savings",
    "officer",
    "trouble",
    "maximum",
    "quarter",
    "traffic",
    "kitchen",
    "minimum",
    "project",
    "finance",
    "mission",
    "contest",
    "lecture",
    "meeting",
    "parking",
    "partner",
    "profile",
    "respect",
    "routine",
    "airline",
    "evening",
    "holiday",
    "husband",
    "mistake",
    "package",
    "patient",
    "stomach",
    "tourist",
    "brother",
    "opening",
    "pattern",
    "request",
    "shelter",
    "comment",
    "monitor",
    "weekend",
    "welcome",
    "bicycle",
    "concert",
    "counter",
    "leather",
    "pension",
    "channel",
    "comfort",
    "passage",
    "promise",
    "station",
    "witness",
    "general",
    "tonight",
    "current",
    "natural",
    "special",
    "working",
    "primary",
    "produce",
    "present",
    "support",
    "complex",
    "regular",
    "reserve",
    "classic",
    "private",
    "western",
    "concern",
    "leading",
    "release",
    "display",
    "extreme",
    "deposit",
    "advance",
    "consist",
    "forever",
    "impress",
    "whereas",
    "combine",
    "command",
    "initial",
    "mention",
    "scratch",
    "illegal",
    "respond",
    "convert",
    "recover",
    "resolve",
    "suspect",
    "anybody",
    "stretch",
    "people",
    "family",
    "health",
    "system",
    "thanks",
    "person",
    "method",
    "theory",
    "nature",
    "safety",
    "player",
    "policy",
    "series",
    "camera",
    "growth",
    "income",
    "energy",
    "nation",
    "moment",
    "office",
    "driver",
    "flight",
    "length",
    "dealer",
    "member",
    "advice",
    "effort",
    "wealth",
    "county",
    "estate",
    "recipe",
    "studio",
    "agency",
    "memory",
    "aspect",
    "cancer",
    "region",
    "device",
    "engine",
    "height",
    "sample",
    "cousin",
    "editor",
    "extent",
    "guitar",
    "leader",
    "singer",
    "tennis",
    "basket",
    "church",
    "coffee",
    "dinner",
    "orange",
    "poetry",
    "police",
    "sector",
    "volume",
    "farmer",
    "injury",
    "speech",
    "winner",
    "worker",
    "writer",
    "breath",
    "cookie",
    "drawer",
    "insect",
    "ladder",
    "potato",
    "sister",
    "tongue",
    "affair",
    "client",
    "throat",
    "number",
    "market",
    "course",
    "school",
    "amount",
    "answer",
    "matter",
    "access",
    "garden",
    "reason",
    "future",
    "demand",
    "action",
    "record",
    "result",
    "period",
    "chance",
    "figure",
    "source",
    "design",
    "object",
    "profit",
    "inside",
    "stress",
    "review",
    "screen",
    "medium",
    "bottom",
    "choice",
    "impact",
    "career",
    "credit",
    "square",
    "effect",
    "friend",
    "couple",
    "debate",
    "living",
    "summer",
    "button",
    "desire",
    "notice",
    "damage",
    "target",
    "animal",
    "author",
    "budget",
    "ground",
    "lesson",
    "minute",
    "bridge",
    "letter",
    "option",
    "plenty",
    "weight",
    "factor",
    "master",
    "muscle",
    "appeal",
    "mother",
    "season",
    "signal",
    "spirit",
    "street",
    "status",
    "ticket",
    "degree",
    "doctor",
    "father",
    "stable",
    "detail",
    "shower",
    "window",
    "corner",
    "finger",
    "garage",
    "manner",
    "winter",
    "battle",
    "bother",
    "horror",
    "phrase",
    "relief",
    "string",
    "border",
    "branch",
    "breast",
    "expert",
    "league",
    "native",
    "parent",
    "salary",
    "silver",
    "tackle",
    "assist",
    "closet",
    "collar",
    "jacket",
    "reward",
    "bottle",
    "candle",
    "flower",
    "lawyer",
    "mirror",
    "purple",
    "stroke",
    "switch",
    "bitter",
    "carpet",
    "island",
    "priest",
    "resort",
    "scheme",
    "script",
    "public",
    "common",
    "change",
    "simple",
    "second",
    "single",
    "travel",
    "excuse",
    "search",
    "remove",
    "return",
    "middle",
    "charge",
    "active",
    "visual",
    "affect",
    "report",
    "beyond",
    "junior",
    "unique",
    "listen",
    "handle",
    "finish",
    "normal",
    "secret",
    "spread",
    "spring",
    "cancel",
    "formal",
    "remote",
    "double",
    "attack",
    "wonder",
    "annual",
    "nobody",
    "repeat",
    "divide",
    "survey",
    "escape",
    "gather",
    "repair",
    "strike",
    "employ",
    "mobile",
    "senior",
    "strain",
    "yellow",
    "permit",
    "abroad",
    "prompt",
    "refuse",
    "regret",
    "reveal",
    "female",
    "invite",
    "resist",
    "stupid",
    "world",
    "music",
    "power",
    "story",
    "media",
    "thing",
    "video",
    "movie",
    "basis",
    "paper",
    "child",
    "month",
    "truth",
    "night",
    "event",
    "phone",
    "scene",
    "death",
    "woman",
    "blood",
    "skill",
    "depth",
    "heart",
    "photo",
    "topic",
    "steak",
    "union",
    "entry",
    "virus",
    "actor",
    "drama",
    "hotel",
    "owner",
    "bread",
    "guest",
    "bonus",
    "queen",
    "ratio",
    "tooth",
    "error",
    "river",
    "buyer",
    "chest",
    "honey",
    "piano",
    "salad",
    "apple",
    "cheek",
    "pizza",
    "shirt",
    "uncle",
    "youth",
    "water",
    "money",
    "while",
    "study",
    "place",
    "field",
    "point",
    "value",
    "guide",
    "state",
    "radio",
    "price",
    "trade",
    "group",
    "force",
    "light",
    "level",
    "order",
    "sense",
    "piece",
    "sport",
    "house",
    "sound",
    "focus",
    "board",
    "range",
    "image",
    "cause",
    "coast",
    "mouse",
    "class",
    "store",
    "space",
    "stock",
    "model",
    "earth",
    "birth",
    "scale",
    "speed",
    "style",
    "craft",
    "frame",
    "issue",
    "cycle",
    "metal",
    "paint",
    "share",
    "black",
    "shape",
    "table",
    "north",
    "voice",
    "brush",
    "front",
    "plant",
    "taste",
    "theme",
    "track",
    "brain",
    "click",
    "staff",
    "sugar",
    "phase",
    "stage",
    "stick",
    "title",
    "novel",
    "carry",
    "fruit",
    "glass",
    "joint",
    "chart",
    "ideal",
    "party",
    "bench",
    "south",
    "stuff",
    "angle",
    "dream",
    "essay",
    "juice",
    "limit",
    "mouth",
    "peace",
    "storm",
    "trick",
    "beach",
    "blank",
    "catch",
    "chain",
    "cream",
    "match",
    "score",
    "screw",
    "agent",
    "block",
    "court",
    "layer",
    "curve",
    "dress",
    "fight",
    "grade",
    "horse",
    "noise",
    "pause",
    "proof",
    "smoke",
    "towel",
    "wheel",
    "aside",
    "buddy",
    "bunch",
    "coach",
    "cross",
    "draft",
    "floor",
    "habit",
    "judge",
    "knife",
    "pound",
    "shame",
    "trust",
    "blame",
    "brick",
    "chair",
    "devil",
    "glove",
    "lunch",
    "nurse",
    "panic",
    "plane",
    "shock",
    "spite",
    "spray",
    "alarm",
    "blind",
    "cable",
    "clerk",
    "cloud",
    "plate",
    "skirt",
    "slice",
    "trash",
    "anger",
    "award",
    "candy",
    "clock",
    "crack",
    "fault",
    "grass",
    "motor",
    "nerve",
    "pride",
    "prize",
    "tower",
    "truck",
    "other",
    "great",
    "being",
    "might",
    "still",
    "start",
    "human",
    "local",
    "today",
    "major",
    "check",
    "guard",
    "offer",
    "whole",
    "dance",
    "worth",
    "spend",
    "drive",
    "green",
    "leave",
    "reach",
    "serve",
    "watch",
    "break",
    "visit",
    "cover",
    "white",
    "final",
    "teach",
    "broad",
    "maybe",
    "stand",
    "young",
    "heavy",
    "hello",
    "worry",
    "press",
    "tough",
    "brown",
    "shoot",
    "touch",
    "pitch",
    "total",
    "treat",
    "abuse",
    "print",
    "raise",
    "sleep",
    "equal",
    "claim",
    "drink",
    "guess",
    "minor",
    "solid",
    "weird",
    "count",
    "doubt",
    "round",
    "slide",
    "strip",
    "march",
    "smell",
    "adult",
    "brief",
    "crazy",
    "prior",
    "rough",
    "laugh",
    "nasty",
    "royal",
    "split",
    "train",
    "upper",
    "crash",
    "funny",
    "quote",
    "spare",
    "sweet",
    "swing",
    "twist",
    "usual",
    "brave",
    "grand",
    "quiet",
    "shake",
    "shift",
    "shine",
    "steal",
    "delay",
    "drunk",
    "hurry",
    "punch",
    "reply",
    "silly",
    "smile",
    "spell",
    "meat",
    "year",
    "data",
    "food",
    "bird",
    "love",
    "fact",
    "idea",
    "area",
    "oven",
    "week",
    "exam",
    "army",
    "goal",
    "news",
    "user",
    "disk",
    "road",
    "role",
    "soup",
    "math",
    "wood",
    "unit",
    "cell",
    "lake",
    "mood",
    "city",
    "debt",
    "loss",
    "bath",
    "mall",
    "hair",
    "mode",
    "song",
    "town",
    "wife",
    "gate",
    "girl",
    "hall",
    "meal",
    "poem",
    "desk",
    "king",
    "menu",
    "beer",
    "dirt",
    "gene",
    "lady",
    "poet",
    "tale",
    "time",
    "work",
    "film",
    "game",
    "life",
    "form",
    "part",
    "fish",
    "back",
    "heat",
    "hand",
    "book",
    "type",
    "home",
    "body",
    "size",
    "card",
    "list",
    "mind",
    "line",
    "care",
    "risk",
    "word",
    "name",
    "boss",
    "page",
    "term",
    "test",
    "kind",
    "soil",
    "rate",
    "site",
    "case",
    "boat",
    "cash",
    "plan",
    "side",
    "rule",
    "head",
    "rock",
    "salt",
    "note",
    "rent",
    "bank",
    "half",
    "fire",
    "step",
    "face",
    "item",
    "room",
    "view",
    "ball",
    "gift",
    "tool",
    "wind",
    "sign",
    "task",
    "hope",
    "date",
    "link",
    "post",
    "star",
    "self",
    "shot",
    "exit",
    "lack",
    "spot",
    "wing",
    "foot",
    "rain",
    "wall",
    "base",
    "pair",
    "text",
    "file",
    "bowl",
    "club",
    "edge",
    "lock",
    "pack",
    "park",
    "skin",
    "sort",
    "baby",
    "dish",
    "trip",
    "gear",
    "land",
    "sale",
    "tree",
    "wave",
    "belt",
    "copy",
    "drop",
    "path",
    "tour",
    "blue",
    "duty",
    "hour",
    "luck",
    "milk",
    "pipe",
    "seat",
    "team",
    "crew",
    "gold",
    "mark",
    "pain",
    "shop",
    "suit",
    "tone",
    "band",
    "bone",
    "coat",
    "door",
    "east",
    "hole",
    "hook",
    "nose",
    "rice",
    "bill",
    "cake",
    "code",
    "ease",
    "farm",
    "host",
    "loan",
    "nail",
    "race",
    "sand",
    "west",
    "wine",
    "blow",
    "chip",
    "dust",
    "golf",
    "iron",
    "mail",
    "mess",
    "pool",
    "shoe",
    "tank",
    "bake",
    "bell",
    "bike",
    "clue",
    "diet",
    "fear",
    "fuel",
    "pace",
    "peak",
    "till",
    "yard",
    "bend",
    "bite",
    "harm",
    "knee",
    "load",
    "neck",
    "ruin",
    "ship",
    "snow",
    "tune",
    "zone",
    "boot",
    "camp",
    "hell",
    "joke",
    "jury",
    "mate",
    "ring",
    "roof",
    "rope",
    "sail",
    "sock",
    "will",
    "many",
    "most",
    "make",
    "good",
    "look",
    "help",
    "read",
    "keep",
    "give",
    "long",
    "play",
    "feel",
    "high",
    "past",
    "show",
    "call",
    "move",
    "turn",
    "hold",
    "main",
    "cook",
    "cold",
    "deal",
    "fall",
    "talk",
    "tell",
    "cost",
    "glad",
    "rest",
    "safe",
    "stay",
    "rise",
    "walk",
    "pick",
    "lift",
    "stop",
    "gain",
    "rich",
    "save",
    "fail",
    "lead",
    "meet",
    "sell",
    "ride",
    "wait",
    "deep",
    "flow",
    "dump",
    "push",
    "fill",
    "jump",
    "kick",
    "pass",
    "vast",
    "beat",
    "burn",
    "dark",
    "draw",
    "hire",
    "join",
    "kill",
    "drag",
    "pull",
    "soft",
    "wear",
    "dead",
    "feed",
    "sing",
    "wish",
    "hang",
    "hunt",
    "hate",
    "sick",
    "hurt",
    "swim",
    "wash",
    "fold",
    "grab",
    "hide",
    "miss",
    "roll",
    "sink",
    "slip",
    "calm",
    "male",
    "mine",
    "rush",
    "suck",
    "bear",
    "dare",
    "dear",
    "kiss",
    "neat",
    "quit",
    "tear",
    "wake",
    "wrap",
    "way",
    "art",
    "map",
    "two",
    "law",
    "mom",
    "lab",
    "mud",
    "pie",
    "son",
    "tea",
    "dad",
    "ear",
    "hat",
    "sir",
    "air",
    "day",
    "job",
    "end",
    "fat",
    "key",
    "top",
    "web",
    "fun",
    "oil",
    "age",
    "bad",
    "tax",
    "man",
    "act",
    "car",
    "dog",
    "sun",
    "war",
    "bus",
    "eye",
    "box",
    "bit",
    "pot",
    "egg",
    "ice",
    "gas",
    "sky",
    "fan",
    "red",
    "log",
    "net",
    "sea",
    "dot",
    "fee",
    "bat",
    "kid",
    "cap",
    "cup",
    "lie",
    "tip",
    "bag",
    "bed",
    "gap",
    "arm",
    "bet",
    "god",
    "pin",
    "bar",
    "boy",
    "row",
    "bid",
    "bug",
    "cat",
    "cow",
    "guy",
    "leg",
    "lip",
    "pen",
    "toe",
    "you",
    "can",
    "one",
    "use",
    "few",
    "she",
    "put",
    "set",
    "big",
    "cut",
    "try",
    "pay",
    "let",
    "ask",
    "buy",
    "low",
    "run",
    "due",
    "mix",
    "fly",
    "hit",
    "cry",
    "eat",
    "fix",
    "tap",
    "win",
    "raw",
    "dig",
    "tie",
    "sad",
    "lay",
    "pop",
    "rip",
    "rub",
    "ad",
    "it",
    "if",
    "go"
];
const colors = [
    "aliceblue",
    "antiquewhite",
    "aqua",
    "aquamarine",
    "ashy",
    "azure",
    "beige",
    "bisque",
    "black",
    "almond",
    "blue",
    "blueviolet",
    "brown",
    "burlywood",
    "cadetblue",
    "chartreuse",
    "chocolate",
    "coral",
    "cornflowerblue",
    "cornsilk",
    "crimson",
    "cyan",
    "darkblue",
    "darkcyan",
    "darkgray",
    "darkgreen",
    "darkgrey",
    "darkkhaki",
    "darkmagenta",
    "darkorange",
    "darkorchid",
    "darkred",
    "darksalmon",
    "darkturquoise",
    "darkviolet",
    "deeppink",
    "deepskyblue",
    "dimgray",
    "dimgrey",
    "dodgerblue",
    "firebrick",
    "floralwhite",
    "forestgreen",
    "fuchsia",
    "gainsboro",
    "ghostwhite",
    "gold",
    "goldenrod",
    "gray",
    "green",
    "greenyellow",
    "grey",
    "honeydew",
    "hotpink",
    "icy",
    "indianred",
    "indigo",
    "ivory",
    "khaki",
    "lavender",
    "lavenderblush",
    "lawngreen",
    "lemon",
    "lemonchiffon",
    "lightblue",
    "lightcoral",
    "lightcyan",
    "lightgray",
    "lightgreen",
    "lightgrey",
    "lightpink",
    "lightsalmon",
    "lightyellow",
    "lime",
    "limegreen",
    "linen",
    "magenta",
    "mango",
    "maroon",
    "midnightblue",
    "mintcream",
    "mistyrose",
    "moccasin",
    "navajowhite",
    "navy",
    "oldlace",
    "olive",
    "olivedrab",
    "orange",
    "orangered",
    "orchid",
    "palegreen",
    "paleturquoise",
    "papayawhip",
    "peachpuff",
    "peru",
    "pink",
    "plum",
    "powderblue",
    "purple",
    "red",
    "rosybrown",
    "royalblue",
    "saddlebrown",
    "salmon",
    "sandybrown",
    "seagreen",
    "seashell",
    "sienna",
    "silver",
    "skyblue",
    "slateblue",
    "slategray",
    "slategrey",
    "snow",
    "springgreen",
    "steelblue",
    "tan",
    "teal",
    "thistle",
    "tomato",
    "transparent",
    "turquoise",
    "violet",
    "wheat",
    "white",
    "whitesmoke",
    "yellow",
    "yellowgreen"
];
const vowels = "aeiouy".split("");
const consonants = "bcdfghjklmnpqrstvwxz".split("");
const digits = "0123456789".split("");
const specialChars = "\\\"'!#$%&()*+,-./:;<=>?@[]^`{|}~".split("");
const assertCount = (n, name)=>{
    if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        throw new TypeError(`Expecting '${name}' to be a non-negative integer, got: ${n}`);
    }
};
const assertProbability = (p, name)=>{
    if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1) {
        throw new RangeError(`Expecting '${name}' to be a number in [0, 1], got: ${p}`);
    }
};
const assertRng = (rng)=>{
    if (typeof rng !== "function") {
        throw new TypeError(`Expecting 'rng' to be a function, got: ${typeof rng}`);
    }
};
const times = (n, cb)=>{
    while(n-- > 0)cb();
};
const defaultOptions = {
    adjCount: 1,
    colorsCount: 1,
    nounsCount: 2,
    syllablesCount: 0,
    digitsCount: 0,
    specialCharsCount: 0,
    randomizeCase: false,
    joinWith: "-"
};
const assertNonEmptyList = (arr, name)=>{
    if (!Array.isArray(arr) || arr.length === 0) {
        throw new TypeError(`Expecting '${name}' to be a non-empty array of strings`);
    }
};
const createGenerator = (opts = {})=>{
    const adjs1 = opts.adjs ?? adjs;
    const colors1 = opts.colors ?? colors;
    const nouns1 = opts.nouns ?? nouns;
    const rng = opts.rng ?? Math.random;
    assertNonEmptyList(adjs1, "adjs");
    assertNonEmptyList(colors1, "colors");
    assertNonEmptyList(nouns1, "nouns");
    assertRng(rng);
    const getRandomInt = (min, exclusiveMax)=>min + Math.floor(rng() * (exclusiveMax - min));
    const getRandomArrayItem = (arr)=>arr[getRandomInt(0, arr.length)];
    const getRandomAdj = ()=>getRandomArrayItem(adjs1);
    const getRandomColor = ()=>getRandomArrayItem(colors1);
    const getRandomNoun = ()=>getRandomArrayItem(nouns1);
    const getRandomVowel = ()=>getRandomArrayItem(vowels);
    const getRandomConsonant = ()=>getRandomArrayItem(consonants);
    const getRandomSyllable = ()=>getRandomConsonant() + getRandomVowel();
    const getRandomDigit = ()=>getRandomArrayItem(digits);
    const getRandomSpecialChar = ()=>getRandomArrayItem(specialChars);
    const randomizeCase = (str)=>str.split("").map((c)=>rng() < 0.5 ? c.toLowerCase() : c.toUpperCase()).join("");
    const getRandomHumanReadable = (options)=>{
        const merged = {
            ...defaultOptions
        };
        if (options) {
            for(const k in options){
                const v = options[k];
                if (v !== undefined) merged[k] = v;
            }
        }
        const { adjCount, colorsCount, nounsCount, syllablesCount, digitsCount, specialCharsCount, randomizeCase: shouldRandomizeCase, joinWith } = merged;
        assertCount(adjCount, "adjCount");
        assertCount(colorsCount, "colorsCount");
        assertCount(nounsCount, "nounsCount");
        assertCount(syllablesCount, "syllablesCount");
        assertCount(digitsCount, "digitsCount");
        assertCount(specialCharsCount, "specialCharsCount");
        if (joinWith !== false && typeof joinWith !== "string") {
            throw new TypeError(`Expecting 'joinWith' to be a string or false, got: ${joinWith}`);
        }
        let out = [];
        times(adjCount, ()=>out.push(getRandomAdj()));
        times(colorsCount, ()=>out.push(getRandomColor()));
        times(nounsCount, ()=>out.push(getRandomNoun()));
        if (syllablesCount) {
            const syls = [];
            times(syllablesCount, ()=>syls.push(getRandomSyllable()));
            out.push(syls.join(""));
        }
        if (digitsCount) {
            const s = [];
            times(digitsCount, ()=>s.push(getRandomDigit()));
            out.push(s.join(""));
        }
        if (specialCharsCount) {
            const s = [];
            times(specialCharsCount, ()=>s.push(getRandomSpecialChar()));
            out.push(s.join(""));
        }
        if (shouldRandomizeCase) out = out.map(randomizeCase);
        return joinWith === false ? out : out.join(joinWith);
    };
    const getRandomSentence = (rhrOptions = [], shorterSentenceProbability = 0.33)=>{
        assertProbability(shorterSentenceProbability, "shorterSentenceProbability");
        if (!rhrOptions.length) {
            rhrOptions = [
                {
                    adjCount: 1,
                    colorsCount: 1,
                    nounsCount: 2
                },
                {
                    adjCount: 2,
                    colorsCount: 0,
                    nounsCount: 2
                },
                {
                    adjCount: 1,
                    colorsCount: 0,
                    nounsCount: 1
                }
            ];
        }
        const ucf = (s)=>s[0].toUpperCase() + s.slice(1);
        const rhr = ()=>getRandomHumanReadable({
                ...getRandomArrayItem(rhrOptions),
                joinWith: " "
            });
        return rng() < shorterSentenceProbability ? ucf(rhr() + ".") : [
            ucf(rhr()),
            getRandomArrayItem([
                " and ",
                " or "
            ]),
            rhr(),
            "."
        ].join("");
    };
    const getRandomParagraph = (minSentences = 1, maxSentences = 5, shorterSentenceProbability = 0.33)=>{
        assertCount(minSentences, "minSentences");
        assertCount(maxSentences, "maxSentences");
        if (minSentences > maxSentences) {
            throw new RangeError(`Expecting 'minSentences' (${minSentences}) <= 'maxSentences' (${maxSentences})`);
        }
        assertProbability(shorterSentenceProbability, "shorterSentenceProbability");
        const out = [];
        const n = getRandomInt(minSentences, maxSentences + 1);
        times(n, ()=>out.push(getRandomSentence([], shorterSentenceProbability)));
        return out.join(" ");
    };
    return {
        data: {
            adjs: adjs1,
            colors: colors1,
            nouns: nouns1
        },
        getRandomAdj,
        getRandomColor,
        getRandomNoun,
        getRandomVowel,
        getRandomConsonant,
        getRandomSyllable,
        getRandomDigit,
        getRandomSpecialChar,
        randomizeCase,
        getRandomHumanReadable,
        getRandomSentence,
        getRandomParagraph
    };
};
let defaultGenerator = createGenerator();
defaultGenerator.data;
const getRandomHumanReadable = (options)=>defaultGenerator.getRandomHumanReadable(options);
function rhr(options = {}) {
    return getRandomHumanReadable({
        joinWith: "-",
        ...options
    });
}
registerStrategy("rhr", (o = {})=>rhr(o));
registerStrategy("order", ()=>"ORD-" + uid("numeric", {
        length: 8
    }));
const CARDS = [
    {
        id: "uuid",
        title: "uuid",
        blurb: "RFC 9562 UUID v4 — 122 random bits straight from crypto.randomUUID(). " + 'The default strategy: uid(), uid("uuid") and uid("uuidv4") are the same call.',
        fields: [],
        call: ()=>({
                strategy: "uuid",
                options: {}
            })
    },
    {
        id: "uuidv7",
        title: "uuidv7",
        blurb: "Time-sortable UUID: a 48-bit millisecond timestamp first, randomness after. " + "Still a valid UUID, so it drops into any uuid column — and ids sort by creation time.",
        fields: [
            {
                name: "timestamp",
                label: "timestamp",
                kind: "datetime",
                hint: "empty = now",
                wide: true
            }
        ],
        call: (v)=>({
                strategy: "uuidv7",
                options: {
                    timestamp: v.timestamp
                }
            }),
        meta: (value)=>`embeds ${formatTime(uuidv7Time(value))}`,
        note: "Generate a few — the prefix only moves forward."
    },
    {
        id: "ulid",
        title: "ulid",
        blurb: "Same idea as uuidv7 but shorter, dash-free and case-insensitive: 10 Crockford " + "base32 chars of timestamp + 16 of randomness. Sortable, but not a valid UUID string.",
        fields: [
            {
                name: "timestamp",
                label: "timestamp",
                kind: "datetime",
                hint: "empty = now",
                wide: true
            }
        ],
        call: (v)=>({
                strategy: "ulid",
                options: {
                    timestamp: v.timestamp
                }
            }),
        meta: (value)=>`embeds ${formatTime(ulidTime(value))}`
    },
    {
        id: "nanoid",
        title: "nanoid",
        blurb: "URL-safe random id over the 64-char set A–Z a–z 0–9 _ - . At the default 21 " + "characters that is ~126 bits — the usual drop-in for a public id in a URL.",
        fields: [
            {
                name: "length",
                label: "length",
                kind: "number",
                value: 21,
                min: 1,
                libraryDefault: 21
            },
            {
                name: "alphabet",
                label: "alphabet",
                kind: "text",
                placeholder: "empty = URL-safe default",
                wide: true
            }
        ],
        call: (v)=>({
                strategy: "nanoid",
                options: {
                    length: v.length,
                    alphabet: v.alphabet
                }
            })
    },
    {
        id: "alphabets",
        title: "named alphabets",
        blurb: "One generator, six curated alphabets. hex and base36 are lowercase; base32 " + "(Crockford) and base58 (Bitcoin) drop look-alike characters; numeric is digits " + "only — the OTP / coupon-code case.",
        fields: [
            {
                name: "strategy",
                label: "alphabet",
                kind: "select",
                value: "base58",
                options: [
                    "hex",
                    "base32",
                    "base36",
                    "base58",
                    "base62",
                    "numeric"
                ]
            },
            {
                name: "length",
                label: "length",
                kind: "number",
                value: 21,
                min: 1,
                hint: "default 21",
                libraryDefault: 21
            }
        ],
        call: (v)=>({
                strategy: String(v.strategy ?? "base58"),
                options: {
                    length: v.length
                }
            }),
        note: (v)=>`${v.strategy}: ${alphabetOf(String(v.strategy))}`
    },
    {
        id: "base56",
        title: "base56",
        blurb: "base58 minus 1 and o, so none of 0 O o 1 l I survive. Safe to read aloud over " + "the phone or retype off a printout.",
        fields: [
            {
                name: "length",
                label: "length",
                kind: "number",
                value: 10,
                min: 1,
                libraryDefault: 21
            }
        ],
        call: (v)=>({
                strategy: "base56",
                options: {
                    length: v.length
                }
            }),
        note: `base56: ${ALPHABETS.base56}`
    },
    {
        id: "base56-uuid",
        title: "base56 ↔ uuid",
        blurb: "A UUID is 128 bits and 23 base56 characters hold exactly that, so the short " + "form is lossless: base56ToUuid() gives you the original back, character for character.",
        fields: [
            {
                name: "uuid",
                label: "uuid",
                kind: "text",
                placeholder: "empty = a fresh uuid",
                wide: true
            }
        ],
        prepare: (v, set)=>{
            if (!v.uuid) set("uuid", uuid());
        },
        call: (v)=>({
                strategy: "base56",
                options: {
                    uuid: v.uuid
                }
            }),
        meta: (value)=>`base56ToUuid() → ${base56ToUuid(value)}`,
        note: "Leave the field empty to encode a fresh uuid each time."
    },
    {
        id: "custom",
        title: "custom",
        blurb: "Any alphabet you like, 1–256 characters. Rejection sampling keeps the output " + "unbiased even when the alphabet size is not a power of two — no modulo skew.",
        fields: [
            {
                name: "alphabet",
                label: "alphabet",
                kind: "text",
                value: "ACGT",
                wide: true
            },
            {
                name: "length",
                label: "length",
                kind: "number",
                value: 24,
                min: 1,
                libraryDefault: 21
            }
        ],
        call: (v)=>({
                strategy: "custom",
                options: {
                    alphabet: v.alphabet,
                    length: v.length
                }
            }),
        note: "Clear the alphabet to see the TypeError — options are validated, never coerced."
    },
    {
        id: "rhr",
        title: "rhr",
        blurb: "Human-readable ids from @marianmeres/random-human-readable. Opt-in, because " + 'its word lists are heavy: import "@marianmeres/uid/rhr" once to register it.',
        fields: [
            {
                name: "adjCount",
                label: "adjectives",
                kind: "number",
                value: 1,
                min: 0,
                max: 4,
                libraryDefault: 1
            },
            {
                name: "colorsCount",
                label: "colors",
                kind: "number",
                value: 1,
                min: 0,
                max: 4,
                libraryDefault: 1
            },
            {
                name: "nounsCount",
                label: "nouns",
                kind: "number",
                value: 2,
                min: 0,
                max: 4,
                libraryDefault: 2
            },
            {
                name: "syllablesCount",
                label: "syllables",
                kind: "number",
                value: 0,
                min: 0,
                max: 4,
                libraryDefault: 0
            },
            {
                name: "digitsCount",
                label: "digits",
                kind: "number",
                value: 0,
                min: 0,
                max: 8,
                libraryDefault: 0
            },
            {
                name: "specialCharsCount",
                label: "specials",
                kind: "number",
                value: 0,
                min: 0,
                max: 4,
                libraryDefault: 0
            },
            {
                name: "joinWith",
                label: "join with",
                kind: "text",
                value: "-",
                allowEmpty: true,
                libraryDefault: "-"
            },
            {
                name: "randomizeCase",
                label: "randomize case",
                kind: "checkbox",
                value: false,
                libraryDefault: false
            }
        ],
        call: (v)=>({
                strategy: "rhr",
                options: {
                    ...v
                }
            })
    },
    {
        id: "counter",
        title: "counter",
        blurb: "An in-memory sequence, one per prefix, alive for the lifetime of the page and " + "reset on reload. For DOM ids, tree nodes and test fixtures — not for " + "cross-process uniqueness. The first call for a prefix fixes its start/step/pad.",
        fields: [
            {
                name: "prefix",
                label: "prefix",
                kind: "text",
                value: "node_",
                libraryDefault: ""
            },
            {
                name: "start",
                label: "start",
                kind: "number",
                value: 0,
                libraryDefault: 0
            },
            {
                name: "step",
                label: "step",
                kind: "number",
                value: 1,
                min: 1,
                libraryDefault: 1
            },
            {
                name: "pad",
                label: "pad",
                kind: "number",
                value: 0,
                min: 0,
                libraryDefault: 0
            }
        ],
        call: (v)=>({
                strategy: "counter",
                options: {
                    prefix: v.prefix,
                    start: v.start,
                    step: v.step,
                    pad: v.pad
                }
            }),
        action: {
            label: "Reset",
            title: "resetCounters(prefix)",
            run: (v)=>resetCounters(String(v.prefix ?? ""))
        },
        note: "Change start/step/pad and the prefix keeps its original config — reset it " + "(or use createCounter() for an isolated instance) to apply the new one."
    },
    {
        id: "reversible",
        title: "reversible",
        blurb: "A hashids-lite integer codec. The salt deterministically shuffles the alphabet, " + "so consecutive row ids stop looking consecutive in your URLs. Obfuscation, not " + "encryption — anyone with the salt can reverse it.",
        fields: [
            {
                name: "value",
                label: "value",
                kind: "number",
                value: 12345,
                min: 0
            },
            {
                name: "salt",
                label: "salt",
                kind: "text",
                value: "my-secret",
                libraryDefault: ""
            },
            {
                name: "minLength",
                label: "min length",
                kind: "number",
                value: 0,
                min: 0,
                libraryDefault: 0
            },
            {
                name: "alphabet",
                label: "alphabet",
                kind: "text",
                placeholder: "empty = base62",
                wide: true
            }
        ],
        call: (v)=>({
                strategy: "reversible",
                options: {
                    value: v.value,
                    salt: v.salt,
                    minLength: v.minLength,
                    alphabet: v.alphabet
                }
            }),
        meta: (value, call)=>`decodeInt() → ${decodeInt(value, call.options)}`,
        after: (v, set)=>set("value", Number(v.value ?? 0) + 1),
        note: "value auto-increments after each encode, so you can see how little " + "neighbouring numbers resemble each other."
    },
    {
        id: "order",
        title: "order — your own",
        blurb: "registerStrategy() puts your own generator behind the same dispatcher. This " + 'one was registered with: registerStrategy("order", () => "ORD-" + ' + 'uid("numeric", { length: 8 })).',
        fields: [],
        call: ()=>({
                strategy: "order",
                options: {}
            })
    }
];
function pruneOptions(options, fields) {
    const out = {};
    for (const [k, v] of Object.entries(options)){
        if (v === undefined) continue;
        if (v === fields[k]?.libraryDefault) continue;
        out[k] = v;
    }
    return out;
}
function snippetOf(call) {
    const parts = Object.entries(call.options).map(([k, v])=>`${k}: ${typeof v === "string" ? JSON.stringify(v) : String(v)}`);
    const opts = parts.length ? `, { ${parts.join(", ")} }` : "";
    return `uid("${call.strategy}"${opts})`;
}
function alphabetOf(name) {
    return ALPHABETS[name] ?? "";
}
function uuidv7Time(id) {
    return Number.parseInt(id.replace(/-/g, "").slice(0, 12), 16);
}
function ulidTime(id) {
    let ms = 0;
    for (const ch of id.slice(0, 10).toUpperCase()){
        ms = ms * 32 + ALPHABETS.base32.indexOf(ch);
    }
    return ms;
}
function formatTime(ms) {
    const d = new Date(ms);
    const p = (n, w = 2)=>String(n).padStart(w, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)} local · ${ms}`;
}
async function copyText(text) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch  {}
    try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        ta.style.top = "0";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
    } catch  {
        return false;
    }
}
function selectText(el) {
    try {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = globalThis.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    } catch  {}
}
const FIELD_TEMPLATE = {
    number: "tpl-field-number",
    text: "tpl-field-text",
    datetime: "tpl-field-datetime",
    checkbox: "tpl-field-checkbox",
    select: "tpl-field-select"
};
function buildField(spec) {
    const el = fromTemplate(FIELD_TEMPLATE[spec.kind]);
    const r = refs(el);
    const input = r.input;
    input.dataset.field = spec.name;
    if (r.label) r.label.textContent = spec.label;
    if (r.hint) {
        r.hint.textContent = spec.hint ?? "";
        r.hint.hidden = !spec.hint;
    }
    if (spec.wide) el.classList.add("is-wide");
    if (spec.kind === "select") {
        for (const value of spec.options ?? []){
            const opt = document.createElement("option");
            opt.value = value;
            opt.textContent = value;
            input.appendChild(opt);
        }
        input.value = String(spec.value ?? spec.options?.[0] ?? "");
    } else if (spec.kind === "checkbox") {
        input.checked = Boolean(spec.value);
    } else {
        const numeric = input;
        if (spec.placeholder) numeric.placeholder = spec.placeholder;
        if (spec.min !== undefined) numeric.min = String(spec.min);
        if (spec.max !== undefined) numeric.max = String(spec.max);
        numeric.value = spec.value === undefined ? "" : String(spec.value);
    }
    return {
        el,
        input
    };
}
function readField(spec, input) {
    if (spec.kind === "checkbox") return input.checked;
    const raw = input.value;
    if (spec.kind === "number") {
        const trimmed = raw.trim();
        return trimmed === "" ? undefined : Number(trimmed);
    }
    if (spec.kind === "datetime") {
        if (!raw) return undefined;
        const ms = Date.parse(raw);
        return Number.isNaN(ms) ? undefined : ms;
    }
    return raw === "" && !spec.allowEmpty ? undefined : raw;
}
function writeField(spec, input, value) {
    if (spec.kind === "checkbox") {
        input.checked = Boolean(value);
    } else {
        input.value = value === undefined || value === null ? "" : String(value);
    }
}
function createCard(spec) {
    return createView((track)=>{
        const el = fromTemplate("tpl-card");
        const r = refs(el);
        const entries = observable([]);
        const values = {};
        const inputs = {};
        const fields = {};
        el.id = `card-${spec.id}`;
        r.title.textContent = spec.title;
        r.blurb.textContent = spec.blurb;
        r.note.hidden = !spec.note;
        for (const field of spec.fields){
            const { el: fieldEl, input } = buildField(field);
            fields[field.name] = field;
            inputs[field.name] = input;
            values[field.name] = readField(field, input);
            r.fields.appendChild(fieldEl);
        }
        r.fields.hidden = spec.fields.length === 0;
        if (spec.action) {
            r.actionBtn.textContent = spec.action.label;
            r.actionBtn.title = spec.action.title;
        } else {
            r.actionBtn.hidden = true;
        }
        const setValue = (name, value)=>{
            const field = fields[name];
            if (!field) return;
            values[name] = value;
            writeField(field, inputs[name], value);
        };
        const currentCall = ()=>{
            const call = spec.call(values);
            return {
                strategy: call.strategy,
                options: pruneOptions(call.options, fields)
            };
        };
        const render = (call = currentCall())=>{
            r.snippet.textContent = snippetOf(call);
            if (typeof spec.note === "function") r.note.textContent = spec.note(values);
            else if (spec.note) r.note.textContent = spec.note;
        };
        const push = (entry)=>{
            entries.update((list)=>[
                    entry,
                    ...list
                ].slice(0, 5));
        };
        const generate = ()=>{
            spec.prepare?.(values, setValue);
            const call = currentCall();
            render(call);
            try {
                const value = uid(call.strategy, call.options);
                let meta;
                try {
                    meta = spec.meta?.(value, call);
                } catch  {}
                push({
                    value,
                    meta
                });
                spec.after?.(values, setValue);
            } catch (e) {
                push({
                    value: String(e?.message ?? e),
                    error: true
                });
            }
        };
        track(delegate(el, {
            change: (_e, target)=>{
                const input = target;
                const name = input.dataset.field;
                values[name] = readField(fields[name], input);
                render();
            },
            generate,
            action: ()=>{
                spec.action?.run(values);
                entries.set([]);
            },
            clear: ()=>entries.set([]),
            copy: (_e, target)=>{
                const valueEl = target.querySelector("[data-ref='value']");
                const badge = target.querySelector("[data-ref='badge']");
                copyText(valueEl?.textContent ?? "").then((ok)=>{
                    if (!ok && valueEl) selectText(valueEl);
                    target.dataset.copied = ok ? "yes" : "no";
                    target.title = ok ? "Copied" : "Clipboard blocked — the id is selected, use your copy shortcut";
                    if (badge) badge.textContent = ok ? "copied" : "failed";
                    globalThis.setTimeout(()=>{
                        delete target.dataset.copied;
                        target.title = "Copy";
                        if (badge) badge.textContent = "copy";
                    }, 1400);
                });
            }
        }));
        track(entries.subscribe((list)=>{
            r.outputs.replaceChildren();
            list.forEach((entry, i)=>{
                const li = fromTemplate(entry.error ? "tpl-output-error" : "tpl-output");
                applyBindings(li, {
                    value: entry.value,
                    meta: entry.meta ?? "",
                    noMeta: !entry.meta
                });
                if (!entry.error && i === 0) li.classList.add("is-latest");
                r.outputs.appendChild(li);
            });
            r.empty.hidden = list.length > 0;
            r.clearBtn.hidden = list.length === 0;
        }));
        render();
        return {
            el,
            generate,
            clear: ()=>entries.set([])
        };
    });
}
const THEME_KEY = "uid-example-dark";
const dark = observable(loadDark());
function loadDark() {
    try {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved !== null) return saved === "1";
    } catch  {}
    return matchMedia("(prefers-color-scheme: dark)").matches;
}
dark.subscribe((on)=>{
    document.documentElement.classList.toggle("dark", on);
    const btn = document.getElementById("dark-toggle");
    btn.textContent = on ? "☀" : "◐";
    btn.title = on ? "Switch to light" : "Switch to dark";
    btn.setAttribute("aria-pressed", String(on));
    try {
        localStorage.setItem(THEME_KEY, on ? "1" : "0");
    } catch  {}
});
document.getElementById("dark-toggle").addEventListener("click", ()=>{
    dark.update((on)=>!on);
});
const grid = document.getElementById("cards");
const cards = CARDS.map(createCard);
for (const card of cards)grid.appendChild(card.el);
document.getElementById("generate-all").addEventListener("click", ()=>{
    for (const card of cards)card.generate();
});
document.getElementById("clear-all").addEventListener("click", ()=>{
    for (const card of cards)card.clear();
});
for (const card of cards)card.generate();
