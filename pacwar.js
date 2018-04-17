function makeSimulator(ctx, cellSize, boardWidth, boardHeight, gene1, gene2)
{
	var size = (boardWidth + 2) * (boardHeight + 2);
	var raw1 = new ArrayBuffer(size);
	var raw2 = new ArrayBuffer(size);
	var worldCurrent = new Uint8Array(raw1);
	var worldNext = new Uint8Array(raw2);

	function setAll(array, value)
	{
		for(var i = 0; i < array.length; ++i)
			array[i] = value;
	}
	
	function setCell(array, x, y, value)
	{
		// the borders are actually not part of the board
		array[(y + 1) * (boardWidth + 2) + (x + 1)] = value;
	}
	
	function getCell(array, x, y)
	{
		return array[(y + 1) * (boardWidth + 2) + (x + 1)];
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
			ctx.fillStyle = "#7f0000";
		else
			ctx.fillStyle = "#00007f";

		var pointAt = 2.0 * Math.PI - direction * Math.PI / 2.0;
		var centerX = (cellX + .5) * cellSize;
		var centerY = (cellY + .5) * cellSize;
		ctx.beginPath();
		ctx.moveTo(centerX, centerY);
		ctx.arc(centerX, centerY, cellSize * .45, pointAt + Math.PI / 4.0, pointAt - Math.PI / 4.0);
		ctx.closePath();
		ctx.fill();

		// cut wedge
	}

	// mites are 5 bit values... bits 1 and 2 are age, bits 3 and 4 are direction, bit 5 is team, bit 0 is always 1 (empty is 0)
	
	function init()
	{
	}
	
	function step()
	{
		// todo: calculate world next
				
		let worldTemp = worldCurrent;
		worldCurrent = worldNext;
		worldNext = worldTemp;	
	}
	
	function drawWorld()
	{
		for(var j = 0; j < boardHeight; ++j)
		{
			for(var i = 0; i < boardWidth; ++i)
			{
				var value = getCell(worldCurrent, i, j);
				if(0 === value)
					drawEmpty(i, j);
				else
				{
					let age = (value >> 1) & 0x3;
					let direction = (value >> 3) & 0x3;
					let team = (value >> 5);
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

	return { drawWorld: drawWorld };
}


window.onload = function()
{
	var canvas = document.getElementById('drawable');
	var boardWidth = 22;
	var boardHeight = 11;
	var cellSizeWidth = window.innerWidth / boardWidth;
	var cellSizeHeight = window.innerHeight / boardHeight;
	var cellSize = Math.min(cellSizeWidth, cellSizeHeight) | 0;
	canvas.height = cellSize * boardHeight;
	canvas.width = cellSize * boardWidth;
	var ctx = canvas.getContext('2d');
	var ones =   "11111111111111111111111111111111111111111111111111";
	var threes = "33333333333333333333333333333333333333333333333333";
	var simulator = makeSimulator(ctx, cellSize, boardWidth, boardHeight, ones, threes);
	simulator.drawWorld();
};