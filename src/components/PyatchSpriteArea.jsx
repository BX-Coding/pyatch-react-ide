import React, { useContext } from 'react';
import { PyatchAddSprite } from './PyatchAddSprite.jsx';
import pyatchContext from './provider/PyatchContext.js';
import { PyatchSelectSprite } from './PyatchSelectSprite.jsx';
import { PyatchSpriteAttributes } from './PyatchSpriteAttributes.jsx';


const PyatchSpriteArea = () => {
    let { pyatchSetSprite } = useContext(pyatchContext);

    const spriteIDArray = pyatchSetSprite["sprites"][0];

    return (
        <div>
            <PyatchSpriteAttributes/>
            
            {spriteIDArray.map((sprite) => {
                return <PyatchSelectSprite key={sprite} spriteID={sprite}/>
            })}
            
            <PyatchAddSprite/>
        </div>
    );
}

export default PyatchSpriteArea