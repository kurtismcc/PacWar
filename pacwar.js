function randomInt(max)
{
	return Math.floor(Math.random() * max) | 0;
}

var roundElem;
var team0ScoreElem;
var team1ScoreElem;

function makeSimulator(ctx, cellSize, boardWidth, boardHeight, gene1, gene2)
{
	var size = (boardWidth + 2) * (boardHeight + 2);
	var worldCurrent = new Uint8Array(new ArrayBuffer(size));
	var worldNext = new Uint8Array(new ArrayBuffer(size));

	function getGene(team)
	{
		if(0 === team)
			return gene1;
		else
			return gene2;
	}
	
	function getGeneSite(index, gene)
	{
		return gene[index] - '0';
	}
	
	function setAll(array, value)
	{
		for(var i = 0; i < array.length; ++i)
			array[i] = value;
	}
	
	function makeMiteValue(age, direction, team)
	{
		direction = direction + 4;
		return 1 | ((age & 0x3) << 1) | ((direction & 0x3 ) << 3) | (team << 5);
	}

	function setCell(array, x, y, arg1, arg2, arg3)
	{
		if(arg2 === undefined && arg3 === undefined)
		{
			// the borders are actually not part of the board
			array[(y + 1) * (boardWidth + 2) + (x + 1)] = arg1;
		}
		else
		{
			setCell(array, x, y, makeMiteValue(arg1, arg2, arg3));
		}
	}
	
	function getCell(array, x, y)
	{
		return array[(y + 1) * (boardWidth + 2) + (x + 1)];
	}
	
	function getTeam(value)
	{
		return (value >> 5);
	}
	
	function getDirection(value)
	{
		return (value >> 3) & 0x3;
	}

	function getAge(value)
	{
		return (value >> 1) & 0x3;
	}
	
	function drawEmpty(cellX, cellY)
	{
		ctx.beginPath();
		ctx.fillStyle = "#007fff";
		ctx.arc((cellX + .5) * cellSize, (cellY + .5) * cellSize, cellSize / 8, 0, 2.0 * Math.PI);
		ctx.fill();
	}
	
	function drawPacMite(cellX, cellY, age, team, direction)
	{
		if(0 === team)
			ctx.fillStyle = "#0000af";
		else
			ctx.fillStyle = "#af0000";

		// position pacMite
		var pointAt = 2.0 * Math.PI - direction * Math.PI / 2.0;
		var centerX = (cellX + .5) * cellSize;
		var centerY = (cellY + .5) * cellSize;
		var radius = cellSize * .45; // fill 90% of cell
		
		// draw filled in part
		ctx.beginPath();
		ctx.moveTo(centerX, centerY);
		ctx.arc(centerX, centerY, cellSize * .45, pointAt + Math.PI / 4.0, pointAt - Math.PI / 4.0);
		ctx.closePath();
		ctx.fill();

		// do each ring
		var step = radius / 4.0;
		for(var i = 0; i < age; ++i) 
		{
			ctx.strokeStyle = "white";
			ctx.beginPath();
			ctx.arc(centerX, centerY, step * (i + 1), 0, Math.PI * 2.0);
			ctx.closePath();
			ctx.stroke();	
		}		
	}

	// mites are 5 bit values... bits 1 and 2 are age, bits 3 and 4 are direction, bit 5 is team, bit 0 is always 1 (empty is 0)
	
	// directions
	// 0 - right, 1 - up, 2 - left, 3 - down (aka, math coordinates, x-axis is 0, and go counterclockwise

	function ageMite(value)
	{
		if(0 === value)
			return 0;
		if(3 == getAge(value))
			return 0; // mite dies from old age
		return makeMiteValue(getAge(value) + 1, getDirection(value), getTeam(value));
	}
	
	let directionAdj = [[ 1, 0 ], [ 0, -1 ], [ -1, 0 ], [ 0, 1]];

	function turnMite(i, j)
	{
		var value = getCell(worldNext, i, j);
		if(0 === getAge(value))
			return value; // new birth or empty, don't turn
		
		let direction = getDirection(value);
		let ni = i + directionAdj[direction][0];
		let nj = j + directionAdj[direction][1];
		if(ni === -1 || ni === boardWidth || nj === -1 || nj === boardHeight)
		{
			// wall (W gene)
			let turnDelta = getGeneSite(20 + getAge(value) - 1, getGene(getTeam(value)));
			return makeMiteValue(getAge(value), getDirection(value) + turnDelta, getTeam(value));
		}
		let facingValue = getCell(worldCurrent, ni, nj);
		if(0 === facingValue)
		{
			// empty cell (X gene)
			let turnDelta = getGeneSite(23 + getAge(value) - 1, getGene(getTeam(value)));
			return makeMiteValue(getAge(value), getDirection(value) + turnDelta, getTeam(value));
		}
		let directionDelta = ((getDirection(facingValue) - getDirection(value)) + 4) % 4;
		if(getTeam(facingValue) === getTeam(value))
		{
			// facing friend (Y gene)
			let turnDelta = getGeneSite(26 + (directionDelta * 3) + getAge(value) - 1, getGene(getTeam(value)));
			return makeMiteValue(getAge(value), getDirection(value) + turnDelta, getTeam(value));
		}
		else if(getTeam(facingValue) !== getTeam(value))
		{
			// facing enemy (Z gene)
			let turnDelta = getGeneSite(38 + (directionDelta * 3) + getAge(value) - 1, getGene(getTeam(value)));
			return makeMiteValue(getAge(value), getDirection(value) + turnDelta, getTeam(value));
		}
		alert("call me maybe?");
	}

	var roundNumber = 0;
	
	function step()
	{
		// second, actually compare the two influencers to see who "wins" the cell (or if cell is emptied)
		for(var j = 0; j < boardHeight; ++j)
		{
			for(var i = 0; i < boardWidth; ++i)
			{
				var numAttackers = 0;
				var strongestAttacker = 0;
				let oldValue = getCell(worldCurrent, i, j);
		
				for(var k = 0; k < 4; ++k)
				{
					var ni = i + directionAdj[k][0];
					var nj = j + directionAdj[k][1];
					var neighbor = getCell(worldCurrent, ni, nj);
					var oppositeDirection = (k + 2) % 4;
					if(0 === neighbor || getDirection(neighbor) !== oppositeDirection)
						continue;
					if(0 === strongestAttacker || getAge(strongestAttacker) < getAge(neighbor))
					{
						strongestAttacker = neighbor;
						numAttackers = 1;
					}
					else if(getAge(strongestAttacker) === getAge(neighbor))
					{
						numAttackers++;
						if(getTeam(oldValue) !== getTeam(neighbor))
							strongestAttacker = neighbor;
					}
				}

				if(0 === numAttackers)
					setCell(worldNext, i, j, ageMite(oldValue)); // no attackers, mite ages
				else if(numAttackers > 1)
				{
					if(getTeam(oldValue) !== getTeam(strongestAttacker))
						setCell(worldNext, i, j, 0); // too many attackers, cell is cleared
					else
						setCell(worldNext, i, j, ageMite(oldValue));					
				}
				else 
				{
					// numAttackers === 1
					if(0 === oldValue)
					{
						// U gene
						var turnDelta = getGeneSite(0 + getAge(strongestAttacker), getGene(getTeam(strongestAttacker)));
						setCell(worldNext, i, j, 0, getDirection(strongestAttacker) + turnDelta, getTeam(strongestAttacker));
					}
					else if(getTeam(oldValue) !== getTeam(strongestAttacker))
					{
						// V gene
						var deltaDirection = (getDirection(oldValue) - getDirection(strongestAttacker) + 4) % 4;
						var turnDelta = getGeneSite(4 + (deltaDirection * 4) + getAge(strongestAttacker), getGene(getTeam(strongestAttacker)));
						setCell(worldNext, i, j, 0, getDirection(strongestAttacker) + turnDelta, getTeam(strongestAttacker));
					}
					else
						setCell(worldNext, i, j, ageMite(oldValue));
				}				
		
				setCell(worldNext, i, j, turnMite(i, j));
			}
		}				
				
		let worldTemp = worldCurrent;
		worldCurrent = worldNext;
		worldNext = worldTemp;	
		++roundNumber;
	}
	
	function drawWorld()
	{
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, boardWidth * cellSize, boardHeight * cellSize);
		var team0Score = 0;
		var team1Score = 0;
		for(var j = 0; j < boardHeight; ++j)
		{
			for(var i = 0; i < boardWidth; ++i)
			{
				var value = getCell(worldCurrent, i, j) | 0;
				if(0 === value)
					drawEmpty(i, j);
				else
				{
					let age = getAge(value);
					let direction = getDirection(value);
					let team = getTeam(value);
					if(0 === team)
						team0Score++;
					else
						team1Score++;
					drawPacMite(i, j, age, team, direction);
				}
			}
		}
		roundElem.innerHTML = roundNumber;
		team0ScoreElem.innerHTML = "Blue Score: " + team0Score;
		team1ScoreElem.innerHTML = "Red Score: " + team1Score;
		return team0Score !== 0 && team1Score !== 0 && 500 > roundNumber;
	}
	
	function drawTestWorld()
	{
		for(var j = 0; j < boardHeight; ++j)
		{
			for(var i = 0; i < boardWidth; ++i)
			{
				let team = randomInt(3);
				if(2 === team)
					drawEmpty(i, j);
				else {
					let age = randomInt(4);
					let direction = randomInt(4);
					drawPacMite(i, j, age, team, direction);
				}
			}
		}
	}

	setAll(worldCurrent, 0);
	setAll(worldNext, 0);
	let inset = (boardWidth / 4) | 0;
	let center = (boardHeight / 2) | 0;
	setCell(worldCurrent, inset, center, 1);
	setCell(worldCurrent, boardWidth - inset - 1, center, 49);

	return { drawWorld: drawWorld, step: step };
}

var simulator;

var genes =
[
  "11111111111111111111111111111111111111111111111111",
  "33333333333333333333333333333333333333333333333333",
  "03100000000020103033311121121111222122131130221131",
  "03100000000020103033311121121111222122131130221131",
  "01310000111120010301133323323322222322213313313313",
  "10320000111122223303112212211222222211300313310300",
  "33320000333322203333232231232231232222133130130130",
  "01000000011100000103123323213213223333313313310311",
  "00020000010002200030121123123323123323311313303311",
  "30320000010022223333332233123123133133103100111110",
  "00020000010002200030123123123123123323301313323311",
  "00300000033122203330323333333333233233113203113110",
  "01310001111120000101133323323322222322313313010313",
  "01300000101120200000133323323323232332310313013313",
  "03000000130322203333211232212211222212130131111130",
  "00100000111022200310121111111211111111331330331201",
  "00020000010002200000123123123123123313313313113321",
  "01000100111122203101233212232232222233310313010310",
  "00100000011022203333122111111211211221131331130300",
  "01000000111022203300121311111211211211301331201301",
  "00020000010002200030123123123123123321311303323311",
  "00020000001022200330321321321121321121123133101101",
  "01000000111100000103123323223213223233313313310310",
  "01310100111100000100133323323322222322313313023313",
  "00020000010002200030123123123123123323311313313313",
  "00020000010002200030123123123123123323300313323313",
  "03000300130022303333211232212211212212131130031133",
  "01030000110122203333233232233232232233310110030130",
  "01000000111122201103233212232232232233313310313310",
  "00100000011022200313121111111211211111331330330101",
  "01000000111122203100233212232232222233333310313310",
  "03010000130022203333211232212211222212130130110131",
  "00020000000022200300321321321121321321123123101101",
  "00300000013102203330323333333333233233110103303110",
  "03100000030020000033311121121122321122131131230121",
  "00020000010002200000123123123123123323311303311321",
  "00020000000002200330321321321131321121131130130131"
];

function resetWorld()
{
	roundElem = document.getElementById('frameno');
	team0ScoreElem = document.getElementById('team0Mites');
	team1ScoreElem = document.getElementById('team1Mites');
	var canvas = document.getElementById('drawable');
	var boardWidth = 19;
	var boardHeight = 9;
	var cellSizeWidth = window.innerWidth / boardWidth;
	var cellSizeHeight = window.innerHeight / boardHeight;
	var cellSize = Math.min(cellSizeWidth, cellSizeHeight) | 0;
	canvas.height = cellSize * boardHeight;
	canvas.width = cellSize * boardWidth;
	var ctx = canvas.getContext('2d');
	var gene1 = document.getElementById('gene1').value;
	var gene2 = document.getElementById('gene2').value;
	simulator = makeSimulator(ctx, cellSize, boardWidth, boardHeight, gene1, gene2);
	simulator.drawWorld();
}

window.onload = function()
{
	var dataList = document.getElementById('genes');
	genes.innerHtml = "";
	genes.forEach(function(gene) {
		var newOption = document.createElement('option');
		newOption.value = gene;
		dataList.appendChild(newOption);
	});
	resetWorld();
};

var shouldStop = true;

function step()
{
	shouldStop = true;
	simulator.step();
	simulator.drawWorld();
}

function run()
{	
	function doStep()
	{
		if(shouldStop)
			return;
		simulator.step();
		shouldStop = !(simulator.drawWorld());
		window.setTimeout(doStep, 100);
	};

	shouldStop = false;
	doStep();
}

function stop()
{
	shouldStop = true;
}