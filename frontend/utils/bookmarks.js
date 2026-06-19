const BOOKMARKS_KEY = "kapruka_flow_bookmarks";

function readList() {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeList(list) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
}

/** Migrate legacy star flags (id-only) into the bookmark list. */
function migrateLegacy() {
  const list = readList();
  const ids = new Set(list.map((b) => b.id));
  let changed = false;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("kapruka_flow_saved_")) continue;
    if (localStorage.getItem(key) !== "true") continue;
    const id = key.replace("kapruka_flow_saved_", "");
    if (!ids.has(id)) {
      list.push({ id, name: id, savedAt: Date.now() });
      ids.add(id);
      changed = true;
    }
  }
  if (changed) writeList(list);
  return list;
}

export function getBookmarks() {
  if (typeof window === "undefined") return [];
  return migrateLegacy();
}

export function isBookmarked(productId) {
  return getBookmarks().some((b) => b.id === productId);
}

export function toggleBookmark(product) {
  const list = getBookmarks();
  const idx = list.findIndex((b) => b.id === product.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    localStorage.removeItem(`kapruka_flow_saved_${product.id}`);
  } else {
    list.unshift({
      id: product.id,
      name: product.name || "Saved product",
      price: product.price?.amount ?? product.price ?? null,
      currency: product.price?.currency || "LKR",
      image_url: product.image_url || "",
      category: product.category || "",
      url: product.url || "",
      savedAt: Date.now(),
    });
    localStorage.setItem(`kapruka_flow_saved_${product.id}`, "true");
  }
  writeList(list);
  return idx < 0;
}

export function removeBookmark(productId) {
  const list = getBookmarks().filter((b) => b.id !== productId);
  writeList(list);
  localStorage.removeItem(`kapruka_flow_saved_${productId}`);
}
