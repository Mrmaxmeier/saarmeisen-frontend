import * as React from 'react';

import { IGameProtocol, IField, IStanding } from './protocol';

import { GameGrid } from './GameGrid';
import { FieldColors } from './FieldVis';
import { StepManager } from './StepManager';

export interface DebuggingSelector {
	ant?: number;
	field?: { x: number; y: number };
}

interface State {
	standings: IStanding[];
	fields: IField[];
	currentStepIndex: number;
	stepTimer?: number;
	debugging?: DebuggingSelector;
}

interface Props {
	size: number;
	game: IGameProtocol;
}

export class GameVis extends React.Component<Props, State> {
	private stepManager: StepManager;

	constructor(props: Props) {
		super(props);
		this.toggleAutoStep = this.toggleAutoStep.bind(this);
		this.stepManager = new StepManager(props.game);
		this.state = this.stepManager.getState();
	}

	componentDidUpdate(prevProps: Props) {
		if (prevProps.game !== this.props.game) {
			this.stepManager = new StepManager(this.props.game);
			this.setState(this.stepManager.getState());
		}
	}

	clearAutoStep() {
		if (this.state.stepTimer) {
			clearInterval(this.state.stepTimer);
			this.setState({ stepTimer: undefined });
		}
	}

	toggleAutoStep() {
		if (this.state.stepTimer) {
			this.clearAutoStep();
		} else {
			const timer = setInterval(() => {
				let next = this.state.currentStepIndex;
				if (next >= this.props.game.steps.length) {
					this.toggleAutoStep();
				} else {
					this.setState(this.stepManager.next());
				}
			}, 100);
			this.setState({ stepTimer: (timer as any) as number });
		}
	}

	render() {
		const { width, height } = this.props.game.init;
		return (
			<div style={{ width: '100%', height: '100%' }}>
				<div>GameVis memes</div>
				{this.state.standings.length ? (
					<table style={{ textAlign: 'center' }}>
						<tbody>
							<tr>
								<th>Swarm</th>
								<th>Color</th>
								<th>Score</th>
								<th>Ants</th>
							</tr>
							{this.state.standings.map(({ score, swarm_id, ants }, i) => (
								<tr key={i}>
									<td>{swarm_id}</td>
									<td style={{ backgroundColor: FieldColors[swarm_id] }} />
									<td>{score}</td>
									<td>{ants}</td>
								</tr>
							))}
						</tbody>
					</table>
				) : null}
				<div>
					Step: {this.state.currentStepIndex} / {this.props.game.steps.length}
				</div>
				<button
					onClick={() => {
						this.stepManager = new StepManager(this.props.game);
						this.setState(this.stepManager.getState());
					}}
				>
					Reset Game
				</button>
				<button
					disabled={!this.stepManager.hasPrev()}
					onClick={() => {
						this.clearAutoStep();
						this.setState(this.stepManager.prev());
					}}
				>
					Prev Step
				</button>
				<button onClick={this.toggleAutoStep}>{this.state.stepTimer ? 'Stop' : 'Play'}</button>
				<button
					disabled={!this.stepManager.hasNext()}
					onClick={() => {
						this.clearAutoStep();
						this.setState(this.stepManager.next());
					}}
				>
					Next Step
				</button>
				<br />
				<GameGrid
					size={this.props.size}
					fields={this.state.fields}
					width={width}
					height={height}
					debuggingSelector={(debugging) => this.setState({ debugging })}
				/>
				<br />
				<div>
					{this.state.debugging ? (
						<span>
							Showing information for: {JSON.stringify(this.state.debugging)}
							<button onClick={() => this.setState({ debugging: undefined })}>Hide</button>
							<br />
							<pre>{JSON.stringify(this.debugInfo(this.state.debugging), null, 2)}</pre>
						</span>
					) : (
						<span>Click (field|ant) to show debugging info</span>
					)}
				</div>
			</div>
		);
	}
	debugInfo(debugging: DebuggingSelector): any {
		if (debugging.field !== undefined) {
			const { x, y } = debugging.field;
			return this.state.fields.find(o => o.x === x && o.y === y);
		} else if (debugging.ant !== undefined) {
			let field = this.state.fields.find(f => !!f.ant && f.ant.id === debugging.ant)
			return field!.ant!
		}
		return { invalid: true }
	}
}
