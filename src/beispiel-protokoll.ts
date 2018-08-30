import { IInit, IStep } from './protocol';

export const init: IInit = {
	width: 2,
	height: 2,
	brains: [
		{
			name: 'brainA',
			swarm_id: 'A',
			instructions: [ 'jump 0' ]
		},
		{
			name: 'brainB',
			swarm_id: 'B',
			instructions: [ 'jump 0' ]
		}
	],
	fields: [
		{ x: 0, y: 0, markers: [], type: '.', food: 5 },
		{
			x: 1,
			y: 0,
			markers: [],
			type: 'A',
			ant: {
				id: 0,
				program_counter: 0,
				swarm_id: 'A',
				carries_food: false,
				direction: 'northwest',
				rest_time: 0,
				register: [ false, false, false, false, false, false ]
			}
		},
		{
			x: 0,
			y: 1,
			markers: [],
			type: 'B',
			ant: {
				id: 1,
				program_counter: 0,
				swarm_id: 'B',
				carries_food: false,
				direction: 'northwest',
				rest_time: 0,
				register: [ false, false, false, false, false, false ]
			}
		},
		{ x: 1, y: 1, markers: [], type: '.', food: 0 }
	]
};

export const steps: IStep[] = [
	{
		standings: [ { swarm_id: 'A', score: 0, ants: 1 }, { swarm_id: 'B', score: 0, ants: 1 } ],
		fields: [
			{
				x: 1,
				y: 0,
				markers: [],
				type: 'A',
				ant: {
					id: 0,
					program_counter: 0,
					swarm_id: 'A',
					carries_food: false,
					direction: 'northwest',
					rest_time: 0,
					register: [ false, false, false, false, false, false ]
				}
			},
			{
				x: 0,
				y: 1,
				markers: [],
				type: 'B',
				ant: {
					id: 1,
					program_counter: 0,
					swarm_id: 'B',
					carries_food: false,
					direction: 'northwest',
					rest_time: 0,
					register: [ false, false, false, false, false, false ]
				}
			}
		]
	}
];
