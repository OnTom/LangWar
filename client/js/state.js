// Aktuální postava tak, jak ji naposledy poslal server
let character = null;
const listeners = new Set();

export function getCharacter() {
  return character;
}

export function setCharacter(c) {
  character = c;
  listeners.forEach((fn) => fn(character));
}

// Zaregistruje funkci volanou při každé změně postavy; vrací odhlášení odběru
export function onCharacterChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
