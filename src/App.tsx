import * as React from 'react';
import './App.css';
import { FileDropZone } from './FileDropZone'
import { HexGrid } from './HexGrid'

class App extends React.Component {
  onGameProtocol(data: any) {
    console.log('onGameProtocol')
  }
  public render() {
    return (
      <div>
        <FileDropZone onData={this.onGameProtocol} />
        <div style={{ width: "100vw", height: "100vh"}}>
          <HexGrid size={80} />
        </div>
      </div>
    );
  }
}

export default App;
