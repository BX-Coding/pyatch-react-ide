import React, { useState, useEffect, useMemo, createContext } from "react";
import PyatchContext from "./PyatchContext.js";
import { PYATCH_EXECUTION_STATES, PYATCH_LOADING_MESSAGES } from "../../util/ExecutionState.js";
import Renderer from 'scratch-render';
import makeTestStorage from "../../util/make-test-storage.mjs";
import VirtualMachine from 'pyatch-vm';
import AudioEngine from 'scratch-audio';


import sprite3ArrBuffer from '../../assets/cat.sprite3';

import { Buffer } from 'buffer-es6'

window.Buffer = Buffer;

const pyatchEditor = {};

export let pyatchVM = null;

let nextSpriteID = 0;

let persistentActiveSprite = 0;

let audioEngine = null;

let currentId = 0;

const PyatchProvider = props => {
  let [sprites, setSprites] = useState([]);

  let [activeSprite, setActiveSpriteState] = useState(0);
  let [activeSpriteName, setActiveSpriteName] = useState();

  let [spriteX, setSpriteX] = useState(0);
  let [spriteY, setSpriteY] = useState(0);
  let [spriteSize, setSpriteSize] = useState(100);
  let [spriteDirection, setSpriteDirection] = useState(90);

  let [errorList, setErrorList] = useState([]);

  //returns array with each line of code for given sprite id
  pyatchEditor.getCodeLines = (sprite) => {
    let linesOfCode = [];
    let prev = 0;
    if(!pyatchEditor.editorText[sprite]){
      return [];
    }
    for(let i = 0; i < pyatchEditor.editorText[sprite].length; i++){
      if(pyatchEditor.editorText[sprite][i]=='\n'){
        linesOfCode.push(pyatchEditor.editorText[sprite].substring(prev, i));
        prev = i+1;
      }
    }
    linesOfCode.push(pyatchEditor.editorText[sprite].substring(prev, pyatchEditor.editorText[sprite].length));
    return linesOfCode;
  }


  function generateError(error){
    let line = error.line;
    let sprite = error.sprite;
    let linesOfCode = pyatchEditor.getCodeLines(sprite);
    let priorText = [];
    let afterText= [];
    for (let i=3; i>0; i--){
      if(line-i-1>=0 && line-i-1<linesOfCode.length)priorText.push(line-i+" "+linesOfCode[line-i-1]);
      if(line-i+3<linesOfCode.length)afterText.push(line-i+4+" "+linesOfCode[line-i+3]);
    }


    let currentError = {
      "uid" : currentId,
      "line" : line,
      "errName" : error.name,
      "priorText" : priorText,
      "afterText" : afterText,
      "sprite" : pyatchEditor.getSpriteName(sprite),
      "errCode" : line + " "+ linesOfCode[line-1]
    };
    currentId++;
    return currentError;
    
  }

  const pyatchSpriteValues = {
    x: spriteX, 
    y: spriteY, 
    size: spriteSize, 
    direction: spriteDirection
  };

  function changeSpriteValues(eventSource = null) {
    // only update the attributes if the active sprite has changes
    if (eventSource) {
      if (eventSource.id !== 'target' + persistentActiveSprite) {
        return;
      }
    }

    setSpriteX(pyatchVM.runtime.targets[persistentActiveSprite].x);
    setSpriteY(pyatchVM.runtime.targets[persistentActiveSprite].y);
    setSpriteSize(pyatchVM.runtime.targets[persistentActiveSprite].size);
    setSpriteDirection(pyatchVM.runtime.targets[persistentActiveSprite].direction);
  }

  [pyatchEditor.editorText, pyatchEditor.setEditorText] = useState([]);
  [pyatchEditor.globalVariables, pyatchEditor.setGlobalVariables] = useState({});

  [pyatchEditor.executionState, pyatchEditor.setExecutionState] = useState(PYATCH_EXECUTION_STATES.PRE_LOAD);
  pyatchEditor.onRunPress = async () => {
    const executionObject = { };
    setErrorList([]);

    sprites.forEach((sprite) => {
      const targetEventMap = {};
      const spriteThreads = pyatchEditor.editorText[sprite];

      spriteThreads.forEach((thread) => {
        if (thread.option === "") {
          targetEventMap[thread.eventId] = [...(targetEventMap[thread.eventId] ?? []), thread.code];
        } else {
          targetEventMap[thread.eventId] = {};
          targetEventMap[thread.eventId][thread.option] = [...(targetEventMap[thread.eventId][thread.option] ?? []), thread.code];
        }
      });
      executionObject['target' + sprite] = targetEventMap;
    });

    await pyatchVM.loadScripts(executionObject);
    await pyatchVM.startHats("event_whenflagclicked");

  }

  pyatchEditor.pyatchMessage = useMemo(() => PYATCH_LOADING_MESSAGES[pyatchEditor.executionState], [pyatchEditor.executionState]);
  pyatchEditor.runDisabled = false;
  pyatchEditor.addSpriteDisabled = false;
  pyatchEditor.stopDisabled = useMemo(() => pyatchEditor.executionState!=PYATCH_EXECUTION_STATES.RUNNING, [pyatchEditor.executionState]);

  const pyatchStage = {
    canvas: document.createElement('canvas'),
    height: 400,
    width: 600,
  };

  [pyatchEditor.eventLabels, pyatchEditor.setEventLabels] = useState({});
  [pyatchEditor.eventOptionsMap, pyatchEditor.setEventOptionsMap] = useState({});
  
  // runs once on window render
  useEffect(() => {
    function effect() {

      const scratchRenderer = new Renderer(pyatchStage.canvas);

      pyatchVM = new VirtualMachine(); 
      pyatchVM.attachRenderer(scratchRenderer);
      pyatchVM.attachStorage(makeTestStorage());

      pyatchEditor.setEventLabels(pyatchVM.getEventLabels());
      pyatchEditor.getEventOptions = pyatchVM.getEventOptionsMap.bind(pyatchVM);

      pyatchVM.runtime.draw();
      pyatchVM.start();

      pyatchEditor.onAddSprite();

      /*Pass in an array of error objects with the folowing properties:
      * {
      *   "name" : the error text
      *   "line" : the integer of the line the error happended on
      *   "sprite" : the integer of the sprite the error happened on
      * }*/
      pyatchVM.on('ERROR_CAUGHT', (errors) => {
        let newErrs = [];
        for(let i=0; i < errors.length; i++){
          newErrs.push(generateError(errors[i]));
        }
        setErrorList(errorList.concat(newErrs));
      });

    }
    effect();
  
  }, []);
  

  pyatchEditor.onStopPress = () => {

  }

  function setActiveSprite(spriteID) {
    persistentActiveSprite = spriteID;
    setActiveSpriteState(spriteID);
  }

  pyatchEditor.onAddSprite = async () => {
    const sprite3 = Buffer.from(sprite3ArrBuffer);

    if(!audioEngine){
      audioEngine = new AudioEngine();
      pyatchVM.attachAudioEngine(audioEngine);
    }

    await pyatchVM.addSprite(sprite3);

    pyatchVM.runtime.targets[nextSpriteID].id = 'target' + nextSpriteID;

    // when RenderedTarget emits this event (anytime position, size, etc. changes), change sprite values
    pyatchVM.runtime.targets[nextSpriteID].on('EVENT_TARGET_VISUAL_CHANGE', changeSpriteValues);

    setSprites(() => [...sprites, nextSpriteID]);

    pyatchEditor.setEditorText(() => [...pyatchEditor.editorText, [{code: "", eventId: "event_whenflagclicked", option: ""}]]);

    setActiveSprite(nextSpriteID);

    nextSpriteID++;

    pyatchVM.runtime.renderer.draw();

  }

  pyatchEditor.onSelectSprite = (spriteID) => {
    setActiveSprite(spriteID);

    changeSpriteValues();
  }

  pyatchEditor.getSpriteName = (spriteID) => {
    if (pyatchVM) {
      return pyatchVM.runtime.getTargetById('target' + spriteID).getName();
    } else {
      return "No Sprite";
    }
  }

  pyatchEditor.setSpriteName = (name) => {
    if (pyatchVM) {
      pyatchVM.runtime.getTargetById('target' + activeSprite).sprite.name = name;
      setActiveSpriteName(name);
    }
  }

  pyatchEditor.getSerializedProject = () => {
    if (pyatchVM) {
      return pyatchVM.serializeProject();
    } else {
      return "";
    }
  }
  pyatchEditor.downloadProject = () => {
    return pyatchVM.downloadProject();
  }

  pyatchEditor.loadSerializedProject = async (vmState) => {
    if (pyatchVM) {
      /* TODO: clear out old targets first */

      var result = await pyatchVM.loadProject(vmState);

      if (result == null) {
        console.warn("Something went wrong and the GUI received a null value for the project to load. Aborting.");
        return;
      }

      nextSpriteID = 0;

      var newTargetsCount = result.importedProject.targets.length;

      var nextSpriteID2 = nextSpriteID;

      if(!audioEngine){
        audioEngine = new AudioEngine();
        pyatchVM.attachAudioEngine(audioEngine);
      }

      let newSprites = [];
      let newText = [];

      for (var i = 0; i < newTargetsCount; i++) {
        // when RenderedTarget emits this event (anytime position, size, etc. changes), change sprite values
        await pyatchVM.runtime.targets[nextSpriteID].on('EVENT_TARGET_VISUAL_CHANGE', changeSpriteValues);

        pyatchVM.runtime.targets[nextSpriteID].id = 'target' + nextSpriteID;

        newSprites.push(nextSpriteID);

        // Time to generate code.
        let smallJSON = result.json.code['target' + nextSpriteID];
        if (smallJSON != null) {
          let threads = [];
          /*let flagClick = smallJSON['event_whenflagclicked'];
          if (flagClick != null && flagClick.forEach instanceof Function) {
            var threadCount = flagClick.length;
            for (var j = 0; j < threadCount; j++) {
              threads[j] = {code: flagClick[j], eventId: 'event_whenflagclicked'};
            }
            /*flagClick.forEach(thread => {
              threads.push({code: thread, eventId: 'event_whenflagclicked'});
            });*//*
          }*/
          let keys = Object.keys(smallJSON);
          if (Array.isArray(keys)) {
            var keyCount = keys.length;
            for (var j = 0; j < keyCount; j++) {
              if (Array.isArray(smallJSON[keys[j]])) {
                smallJSON[keys[j]].forEach(code => {
                  threads.push({code: code, eventId: keys[j], option: ''});
                });
              } else {
                let optionKeys = Object.keys(smallJSON[keys[j]]);
                optionKeys.forEach(realKey => {
                  //threads.push({code: realCode, eventId: keys[j], option: code});
                  smallJSON[keys[j]][realKey].forEach(realCode => {
                    threads.push({code: realCode, eventId: keys[j], option: realKey});
                  })
                });
              }
            }
          }
          newText.push(threads);
        } else {
          newText.push([{code: '', eventId: 'event_whenflagclicked'}]);
        }

        //setActiveSprite(nextSpriteID);

        nextSpriteID++;
      }

      setSprites(() => newSprites);
      pyatchEditor.setEditorText(() => newText);
      

      //await pyatchVM.loadScripts(result.json.code);
      setActiveSprite(0);
      
      //pyatchVM.runtime.renderer.draw();
      //return;
    } else {
      //return null;
    }
  }

  return (
   <>
   <PyatchContext.Provider
      value={{pyatchEditor, pyatchStage, pyatchSpriteValues, sprites, activeSprite, activeSpriteName, errorList}}
    >
      {props.children}
    </PyatchContext.Provider>
    </>
  );
};

export default PyatchProvider;