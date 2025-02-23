import {
	log,
	// Log4Deno deps
	LT,
} from '../../deps.ts';

import { roll } from './roller.ts';
import { SolvedStep } from './solver.d.ts';

// formatRoll(rollConf, maximiseRoll, nominalRoll) returns one SolvedStep
// formatRoll handles creating and formatting the completed rolls into the SolvedStep format
export const formatRoll = (rollConf: string, maximiseRoll: boolean, nominalRoll: boolean): SolvedStep => {
	let tempTotal = 0;
	let tempDetails = '[';
	let tempCrit = false;
	let tempFail = false;

	// Generate the roll, passing flags thru
	const tempRollSet = roll(rollConf, maximiseRoll, nominalRoll);

	// Loop thru all parts of the roll to document everything that was done to create the total roll
	tempRollSet.forEach((e) => {
		log(LT.LOG, `Formatting roll ${rollConf} | ${JSON.stringify(e)}`);
		let preFormat = '';
		let postFormat = '';

		if (!e.dropped && !e.rerolled) {
			// If the roll was not dropped or rerolled, add it to the stepTotal and flag the critHit/critFail
			tempTotal += e.roll;
			if (e.critHit) {
				tempCrit = true;
			}
			if (e.critFail) {
				tempFail = true;
			}
		}
		// If the roll was a crit hit or fail, or dropped/rerolled, add the formatting needed
		if (e.critHit) {
			// Bold for crit success
			preFormat = `**${preFormat}`;
			postFormat = `${postFormat}**`;
		}
		if (e.critFail) {
			// Underline for crit fail
			preFormat = `__${preFormat}`;
			postFormat = `${postFormat}__`;
		}
		if (e.dropped || e.rerolled) {
			// Strikethrough for dropped/rerolled rolls
			preFormat = `~~${preFormat}`;
			postFormat = `${postFormat}~~`;
		}

		// Finally add this to the roll's details
		tempDetails += `${preFormat}${e.roll}${postFormat} + `;
	});
	// After the looping is done, remove the extra " + " from the details and cap it with the closing ]
	tempDetails = tempDetails.substring(0, tempDetails.length - 3);
	tempDetails += ']';

	return {
		total: tempTotal,
		details: tempDetails,
		containsCrit: tempCrit,
		containsFail: tempFail,
	};
};
