export type Direction = 'northwest' | 'west' | 'southwest' | 'southeast' | 'east' | 'northeast';

export interface IAnt {
	id: number;
	program_counter: number;
	swarm_id: string;
	carries_food: boolean;
	direction: Direction;
	rest_time: number;
	register: [boolean, boolean, boolean, boolean, boolean, boolean];
}

export interface IMarker {
	swarm_id: string;
	values: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
}

export interface IField {
	x: number;
	y: number;
	markers: IMarker[];
	type: string;
	ant?: IAnt;
	food?: number;
}

export interface IStanding {
	swarm_id: string;
	score: number;
	ants: number;
}

export interface IBrain {
	name: string;
	swarm_id: string;
	instructions: string[];
}

export interface IStep {
	standings: IStanding[];
	fields: IField[];
}

export interface IInit {
	width: number;
	height: number;
	brains: IBrain[];
	fields: IField[];
}

export interface IGameProtocol {
	init: IInit;
	steps: IStep[];
}

function brain(id: string, instructions?: string[]): IBrain {
	return {
		name: 'brain' + id,
		swarm_id: id,
		instructions: instructions || [ 'jump 0' ]
	};
}

function ant(id: number, swarm_id: string): IAnt {
	return {
		id,
		program_counter: 0,
		swarm_id,
		carries_food: false,
		direction: 'northwest',
		rest_time: 0,
		register: [ false, false, false, false, false, false ]
	};
}

function field(x: number, y: number, bant?: IAnt): IField {
	return {
		x,
		y,
		type: bant === undefined ? '.' : bant.swarm_id,
		markers: [],
		ant: bant
	};
}

function iterFields(w: number, h: number): Array<{ x: number; y: number }> {
	return (new Array(w * h) as any).fill(null).map((_: any, i: number) => {
		return { x: i % w, y: (Math as any).trunc(i / w) };
	});
}

let fields: { [key: string]: IField } = {
	'0, 0': field(0, 0, ant(0, 'A')),
	'2, 2': field(2, 2, ant(0, 'B')),
	'1, 1': { ...field(1, 1), type: '#' },
	'1, 0': { ...field(1, 0), type: '.', food: 5 },
	'2, 3': {
		...field(2, 3),
		type: '.',
		markers: [
			{
				swarm_id: 'A',
				values: [ true, true, false, false, true, true, false ]
			}
		]
	}
};

let init: IInit = {
	height: 4,
	width: 4,
	brains: [ brain('A', [ 'move else 0', 'jump 0' ]), brain('B') ],
	fields: iterFields(4, 4).map(({ x, y }) => {
		let s = `${x}, ${y}`;
		return fields[s] || field(x, y);
	})
};

let movementA = [
	{ x: 0, y: 0 },
	{ x: 3, y: 3 },
	{ x: 3, y: 2 },
	{ x: 2, y: 1 },
	{ x: 2, y: 0 },
	{ x: 1, y: 3 },
	{ x: 1, y: 2 },
	{ x: 0, y: 1 }
];

let standings = [ { swarm_id: 'A', score: 0, ants: 1 }, { swarm_id: 'B', score: 0, ants: 1 } ];

let steps: IStep[] = [];

for (let i = 0; i < 50; i++) {
	let from = movementA[i % movementA.length];
	let to = movementA[(i + 1) % movementA.length];
	steps.push({
		standings,
		fields: [ field(from.x, from.y), field(to.x, to.y, ant(0, 'A')) ]
	});
}

export const game: IGameProtocol = {
	init,
	steps
};

// console.log(JSON.stringify(game, null, 2));
console.log(JSON.stringify(game));
