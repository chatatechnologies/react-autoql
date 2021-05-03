import React from 'react';
import { css } from '@emotion/core';
import  {PulseLoader}  from 'react-spinners';

const override = css`
    position: absolute;
    justify-content: center;
    display: flex;
    height: 50vh;
    width: 100vw;
    top: 50vh;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 99;
`;

function Loading (props)  {
    return(
    <div
        style={{
            backgroundColor: props.isLightTheme ? '#F1F3F5' : '#20252A',
            minHeight: '100vh',
        }}
    >
        <PulseLoader css={override} sizeUnit={'px'} size={20} color={'#25A7E9'} />
    </div>)
};

export default Loading;
