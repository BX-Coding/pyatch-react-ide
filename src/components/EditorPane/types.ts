import EventEmitter from "events"

export type Asset = {
    assetId: string,
    assetType: string,
}

export type Costume = {
    assetId: string,
    name: string,
    md5?: string,
    md5ext: string,
    textLayerMD5?: string,
    bitmapResolution: number,
    asset?: Asset,
    dataFormat: string,
    rotationCenterX: number,
    rotationCenterY: number,
}

export type Sound = {
    assetId: string,
    name: string,
    md5?: string,
    md5ext: string,
    asset?: Asset,
    dataFormat: string,
    format: string,
    rate: number,
    sampleCount: number,
}

export interface Thread {
    status: number,
    id: string,
    blockUtility: any,
    script: string,
    triggerEvent: string,
    triggerEventOption: string,
    loadPromise: Promise<boolean>,
    interruptThread: boolean,
    running: boolean,

    updateThreadScript: (script: string) => void,
    updateThreadTriggerEvent: (trigger: string) => void,
    updateThreadTriggerEventOption: (option: string) => void,
}

export interface Sprite {
    id: string,
    name: string,
    isStage: boolean,
    currentCostume: number,
    costumes: Costume[],
}

export interface SpriteJson {
    name: string,
    tags: string[],
    isStage: boolean,
    variables?: {},
    costumes: Costume[],
    sounds: Sound[],
    blocks?: {},
}

export interface Target extends EventEmitter {
    id: string,
    name: string,
    isStage: boolean,
    currentCostume: number,
    costumes: Costume[],
    threads: { [key: string]: Thread },
    sprite: Sprite,

    getThread: (id: string) => Thread,
    addThread: (id: string, trigger: string, script: string) => string,
    getCurrentCostume: () => Costume,
}