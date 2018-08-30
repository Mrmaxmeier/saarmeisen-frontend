import * as React from 'react';
import './App.css';
import { FileDropZone } from './FileDropZone';
import { GameVis } from './GameVis';
import { game as sampleGame, IGameProtocol } from './protocol';

interface IState {
	size: number;
	game: IGameProtocol;
}

class App extends React.Component<{}, IState> {
	constructor(props: {}) {
		super(props);

		this.state = {
			size: 80,
			game: sampleGame
		};

		this.onGameProtocol = this.onGameProtocol.bind(this);
	}
	onGameProtocol(data: any) {
		console.log('onGameProtocol');
		const game = data as IGameProtocol;
		this.setState({ game });
	}
	public render() {
		return (
			<div>
				<table>
					<tbody>
						<tr>
							<th>Abcdefg</th>
							<td><a href="https://github.com/Mrmaxmeier/saarmeisen-frontend">github.com/Mrmaxmeier/saarmeisen-frontend</a></td>
						</tr>
						<tr>
							<th>Protocol</th>
							<td>
								<FileDropZone onData={this.onGameProtocol} />
							</td>
						</tr>
						<tr>
							<th>HexSize</th>
							<td>
								<input
									type="number"
									value={this.state.size}
									onChange={(e) => this.setState({ size: parseInt(e.target.value, 10) })}
								/>
							</td>
						</tr>
					</tbody>
				</table>
				<div style={{ width: '100vw', height: '100vh' }}>
					<GameVis {...this.state} />
				</div>
			</div>
		);
	}
}

export default App;
