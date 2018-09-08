import { Inflate, Data } from "pako";
import { IInit, IStep } from "./protocol";
import { IStepManager, GameState, applyFieldChange } from "./StepManager";

export class GzipGameStream implements IStepManager {
  public init: IInit;

  private data: Uint8Array;
  private stream: JsonGZIPStream;
  private state: GameState;
  private buffer: IStep | null;

  constructor(data: Uint8Array) {
    this.data = data;
    this.reset();
  }

  reset() {
    this.stream = new JsonGZIPStream(this.data);
    let first = this.stream.fsm_step();
    this.init = first.init!;
    this.buffer = this.stream.fsm_step().step!;
    this.state = {
      currentStepIndex: 0,
      fields: this.init.fields,
      standings: this.buffer!.standings,
      stepCount: "???"
    };
  }

  hasNext() {
    return this.buffer !== null;
  }
  hasPrev() {
    return false;
  }

  next(): GameState {
    if (!this.buffer) {
      return this.state;
    }
    this.state = {
      ...this.state,
      currentStepIndex: this.state.currentStepIndex + 1,
      fields: applyFieldChange(this.state.fields, this.buffer.fields),
      stepCount: estimateCount(
        this.stream.i / this.stream.binData.length,
        this.state.currentStepIndex
      )
    };
    this.buffer = this.stream.fsm_step().step;
    return this.state;
  }
  prev(): GameState {
    throw new Error("invalid operation");
  }
  getState(): GameState {
    return this.state;
  }
}

const GZ_CHUNK_SIZE = 2 ** 14;
export class JsonGZIPStream {
  public i: number;
  public stage: number;
  public binData: Uint8Array;

  private inflate: Inflate;
  private chunks: Data[];

  private decoder: TextDecoder;
  private toDecode: string;

  private braceLevel: number;
  private bracketLevel: number;

  constructor(binData: Uint8Array) {
    this.inflate = new Inflate();
    this.inflate.onData = this.processChunk.bind(this);
    this.binData = binData;
    this.chunks = [];
    this.i = 0;
    this.stage = 0;

    this.decoder = new TextDecoder("utf-8");
    this.toDecode = "";

    this.braceLevel = -1;
    this.bracketLevel = 1;
  }

  fsm_step(): { end?: boolean; init?: any; step?: any } {
    console.log("fsm_step");
    if (this.stage === 3) {
      throw new Error("stream ended");
    }
    while (!this.markJSONChunk()) {
      //
    }
    switch (this.stage) {
      case 0:
        if (!this.toDecode.startsWith('{"init":{')) {
          throw Error(
            "the json file, in case this is actually gzipped json, is not supported"
          );
        }
        let initStr = this.toDecode.slice(this.toDecode.indexOf("{", 1));
        this.braceLevel = 0;
        this.bracketLevel = 1;
        this.toDecode = "";
        this.stage += 1;
        return { init: JSON.parse(initStr) };
      case 1:
        if (!this.toDecode.startsWith(',"steps":[{')) {
          throw new Error("unlucky json formatting");
        }
        let stepStr = this.toDecode.slice(this.toDecode.indexOf("{"));
        this.toDecode = "";
        this.stage += 1;
        this.bracketLevel = 1;
        return { step: JSON.parse(stepStr) };
      case 2:
        if (this.bracketLevel === 0) {
          this.stage += 1;
          return { end: true };
        }
        if (!this.toDecode.startsWith(",")) {
          throw new Error("unlucky liste");
        }
        let step = JSON.parse(this.toDecode.slice(1));
        this.toDecode = "";
        return { step };
    }
    return {};
  }

  markJSONChunk(): boolean {
    while (!this.chunks.length) {
      this.inflateChunk();
    }
    let chunk = this.chunks[0];
    for (let i = 0; i < chunk.length; i++) {
      let c = chunk[i];
      if (c === "[".codePointAt(0)) {
        this.bracketLevel++;
      }
      if (c === "]".codePointAt(0)) {
        this.bracketLevel--;
      }
      if (c === "{".codePointAt(0)) {
        this.braceLevel++;
      }
      if (c === "}".codePointAt(0)) {
        this.braceLevel--;
      }

      if (
        (this.braceLevel === 0 && c === "}".codePointAt(0)) ||
        (this.bracketLevel === 0 && c === "]".codePointAt(0))
      ) {
        this.toDecode += this.decoder.decode(chunk.slice(
          0,
          i + 1
        ) as Uint8Array);
        this.chunks[0] = this.chunks[0].slice(i + 1);
        return true;
      }
    }
    this.toDecode += this.decoder.decode(chunk as Uint8Array);
    this.chunks.shift();
    return false;
  }

  processChunk(chunk: Data) {
    this.chunks.push(chunk);
  }

  inflateChunk(): boolean {
    if (this.i >= this.binData.length) {
      throw new Error("TODO: does this break things");
      return false;
    }
    if (this.i + GZ_CHUNK_SIZE >= this.binData.length) {
      this.inflate.push(
        this.binData.subarray(this.i, this.i + GZ_CHUNK_SIZE),
        true
      );
    } else {
      this.inflate.push(
        this.binData.subarray(this.i, this.i + GZ_CHUNK_SIZE),
        false
      );
    }
    this.i += GZ_CHUNK_SIZE;
    return true;
  }
}

function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function estimateCount(progress: number, current: number): string {
  let totalSteps = current / progress;
  let dgs = Math.log10(totalSteps);
  let prec = Math.pow(
    10,
    Math.trunc(dgs * (1 - easeInOutQuad((progress * 2) / 3)))
  );
  return `est. ${Math.round(totalSteps / prec) * prec}`;
}
