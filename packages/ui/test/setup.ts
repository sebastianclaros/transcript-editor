// jsdom test setup: a controllable fake for HTMLMediaElement and layout stubs.
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

interface MediaState {
  currentTime: number;
  paused: boolean;
  duration: number;
  playbackRate: number;
  defaultPlaybackRate: number;
  readyState: number;
  src: string;
}

const states = new WeakMap<HTMLMediaElement, MediaState>();
export const MEDIA_DURATION = 120;

function st(el: HTMLMediaElement): MediaState {
  let s = states.get(el);
  if (!s) {
    s = {
      currentTime: 0,
      paused: true,
      duration: Number.NaN,
      playbackRate: 1,
      defaultPlaybackRate: 1,
      readyState: 0,
      src: "",
    };
    states.set(el, s);
  }
  return s;
}

const proto = HTMLMediaElement.prototype;
const def = (name: string, desc: PropertyDescriptor) =>
  Object.defineProperty(proto, name, { configurable: true, ...desc });

def("currentTime", {
  get(this: HTMLMediaElement) {
    return st(this).currentTime;
  },
  set(this: HTMLMediaElement, v: number) {
    st(this).currentTime = v;
    this.dispatchEvent(new Event("seeked"));
  },
});
def("paused", {
  get: function (this: HTMLMediaElement) {
    return st(this).paused;
  },
});
def("duration", {
  get: function (this: HTMLMediaElement) {
    return st(this).duration;
  },
});
def("readyState", {
  get: function (this: HTMLMediaElement) {
    return st(this).readyState;
  },
});
def("currentSrc", {
  get: function (this: HTMLMediaElement) {
    return st(this).src;
  },
});
for (const k of ["playbackRate", "defaultPlaybackRate"] as const) {
  def(k, {
    get(this: HTMLMediaElement) {
      return st(this)[k];
    },
    set(this: HTMLMediaElement, v: number) {
      st(this)[k] = v;
      if (k === "playbackRate") this.dispatchEvent(new Event("ratechange"));
    },
  });
}
def("preservesPitch", { get: () => true, set: () => {} });
def("play", {
  value(this: HTMLMediaElement) {
    st(this).paused = false;
    this.dispatchEvent(new Event("play"));
    this.dispatchEvent(new Event("playing"));
    return Promise.resolve();
  },
});
def("pause", {
  value(this: HTMLMediaElement) {
    st(this).paused = true;
    this.dispatchEvent(new Event("pause"));
  },
});
// The real element resets playbackRate when `src` changes and then fires load events.
// React sets `src` with setAttribute, scripts with the property: handle both.
function applySrc(el: HTMLMediaElement, v: string) {
  const s = st(el);
  s.src = v;
  s.playbackRate = s.defaultPlaybackRate = 1;
  s.currentTime = 0;
  s.paused = true;
  s.readyState = 0;
  s.duration = Number.NaN;
  el.dispatchEvent(new Event("loadstart"));
  // metadata arrives asynchronously
  setTimeout(() => {
    s.readyState = 4;
    s.duration = MEDIA_DURATION;
    for (const e of ["loadedmetadata", "durationchange", "loadeddata", "canplay"])
      el.dispatchEvent(new Event(e));
  }, 0);
}
const srcDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
const origSetAttribute = Element.prototype.setAttribute;
def("src", {
  get(this: HTMLMediaElement) {
    return srcDesc?.get?.call(this) as string;
  },
  set(this: HTMLMediaElement, v: string) {
    origSetAttribute.call(this, "src", v);
    applySrc(this, v);
  },
});
Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
  origSetAttribute.call(this, name, value);
  if (this instanceof HTMLMediaElement && name === "src") applySrc(this, value);
};

/** Test helpers to drive the fake element. */
export function setMediaTime(el: HTMLMediaElement, t: number) {
  st(el).currentTime = t;
}
export function fireTimeUpdate(el: HTMLMediaElement) {
  el.dispatchEvent(new Event("timeupdate"));
}

Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
