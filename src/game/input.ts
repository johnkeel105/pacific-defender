export class Input {
  keys = new Set<string>();
  forced = new Set<string>();
  lookX = 0;
  lookY = 0;
  firing = false;
  rmb = false;
  zoomHold = false;
  pointerId: number | null = null;
  lookPointer: number | null = null;
  lastLookX = 0;
  lastLookY = 0;
  wheel = 0;
  private canvas: HTMLCanvasElement;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onBlur: () => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onMouseDown: (e: MouseEvent) => void;
  private onMouseUp: (e: MouseEvent) => void;
  private onWheel: (e: WheelEvent) => void;
  private onPointerDown: (e: PointerEvent) => void;
  private onPointerMove: (e: PointerEvent) => void;
  private onPointerUp: (e: PointerEvent) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.onKeyDown = (e) => {
      this.keys.add(e.code);
      if (
        e.code === "Space" ||
        e.code.startsWith("Arrow") ||
        e.code === "KeyW" ||
        e.code === "KeyA" ||
        e.code === "KeyS" ||
        e.code === "KeyD"
      ) {
        e.preventDefault();
      }
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onBlur = () => {
      this.keys.clear();
      this.firing = false;
      this.rmb = false;
      this.zoomHold = false;
    };
    this.onMouseMove = (e) => {
      if (document.pointerLockElement === this.canvas || e.buttons === 1) {
        this.lookX += e.movementX;
        this.lookY += e.movementY;
      }
    };
    this.onMouseDown = (e) => {
      if (e.button === 0 && e.target === this.canvas) this.firing = true;
      if (e.button === 2) this.rmb = true;
    };
    this.onMouseUp = (e) => {
      if (e.button === 0) this.firing = false;
      if (e.button === 2) this.rmb = false;
    };
    this.onWheel = (e) => {
      if (document.pointerLockElement === this.canvas) {
        e.preventDefault();
        this.wheel += Math.sign(e.deltaY);
      }
    };
    this.onPointerDown = (e) => {
      if (document.pointerLockElement === this.canvas) return;
      if (e.pointerType === "mouse") return;
      const r = this.canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      if (x > r.width * 0.42) {
        this.lookPointer = e.pointerId;
        this.lastLookX = e.clientX;
        this.lastLookY = e.clientY;
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    };
    this.onPointerMove = (e) => {
      if (this.lookPointer !== e.pointerId) return;
      this.lookX += e.clientX - this.lastLookX;
      this.lookY += e.clientY - this.lastLookY;
      this.lastLookX = e.clientX;
      this.lastLookY = e.clientY;
    };
    this.onPointerUp = (e) => {
      if (this.lookPointer === e.pointerId) this.lookPointer = null;
    };

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onBlur);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
  }

  held(code: string) {
    return this.keys.has(code) || this.forced.has(code);
  }

  zooming() {
    return this.rmb || this.zoomHold || this.held("ShiftLeft") || this.held("ShiftRight");
  }

  consumeLook() {
    const x = this.lookX;
    const y = this.lookY;
    this.lookX = 0;
    this.lookY = 0;
    return { x, y };
  }

  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  setKeys(codes: string[]) {
    this.forced = new Set(codes);
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onBlur);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
  }
}
