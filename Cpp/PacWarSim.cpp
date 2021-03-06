#include <cstdint>
#include <stdio.h>
#include <utility>

struct PacGene
{
	uint8_t u[4];
	uint8_t v[4][4];
	uint8_t w[3];
	uint8_t x[3];
	uint8_t y[4][3];
	uint8_t z[4][3];
};

void SetGene(const char* str, PacGene& gene)
{
	uint8_t *ptr = &gene.u[0];
	for(int i = 0; i < 50; ++i)
		*ptr++ = *str++ - '0';
}

class PacWarSimulator
{
private:

	// possible values for Cell::team
	static constexpr uint8_t kTeam0 = 0;
	static constexpr uint8_t kTeam1 = 1;

	// possible directions
	static constexpr uint8_t kRight = 0;
	static constexpr uint8_t kUp = 1;
	static constexpr uint8_t kLeft = 2;
	static constexpr uint8_t kDown = 3;

	struct DirectionAdj
	{
		int x;
		int y;
	};

	static constexpr DirectionAdj s_directionAdj[4] = { { 1, 0 }, { 0, -1 }, { -1, 0 }, { 0, 1 } };

	struct Cell
	{
		uint8_t occupied : 1;
		uint8_t team : 1;
		uint8_t age : 2;
		uint8_t direction : 2;
	};
	static constexpr Cell& cell_cast(uint8_t& val) { return reinterpret_cast<Cell&>(val); }
	static constexpr uint8_t& cell_cast(Cell& val) { return reinterpret_cast<uint8_t&>(val); }
	static constexpr Cell cell_cast(int val) { uint8_t v = val; return cell_cast(v); }

	static constexpr int kBoardWidth = 19;
	static constexpr int kBoardHeight = 9;

	using World = Cell[kBoardHeight+2][kBoardWidth+2];

	World m_world[2];
	World *m_current;
	World *m_next;

	PacGene m_gene0;
	PacGene m_gene1;

	uint32_t m_team0Count;
	uint32_t m_team1Count;

	struct NeighborInfo
	{
		uint8_t numAttackers = 0;
		Cell strongestAttacker = cell_cast(0);
	};

	Cell ageMite(Cell c)
	{
		if(0 == cell_cast(c))
			return c;
		if(3 == c.age)
			return cell_cast(0); // mite dies
		else
		{
			c.age = c.age + 1;
			return c;
		}
	}

public:
	PacWarSimulator(const char* gene1, const char* gene2)
	{
		SetGene(gene1, m_gene0);
		SetGene(gene2, m_gene1);

		uint32_t count = (kBoardWidth + 2) * (kBoardHeight * 2);
		m_current = &m_world[0];
		m_next = &m_world[1];
		Cell *curPtr = (Cell*)&m_world[0];
		Cell *nextPtr = (Cell*)&m_world[1];
		while(count--)
		{
			*curPtr++ = cell_cast(0);
			*nextPtr = cell_cast(0);
		}

		// set starting mites
		Cell& a = (*m_current)[5][5];
		Cell& b = (*m_current)[5][15];
		a.occupied = 1;
		a.team = 0;
		a.direction = 0;
		a.age = 0;
		b.occupied = 1;
		b.team = 1;
		b.direction = 2;
		b.age = 0;
		m_team0Count = 1;
		m_team1Count = 1;
	}

	const PacGene& Gene(uint8_t team)
	{
		if(kTeam0 == team)
			return m_gene0;
		else
			return m_gene1;
	}

	void Step()
	{
		NeighborInfo ni[kBoardHeight+2][kBoardWidth+2];
		m_team0Count = 0;
		m_team1Count = 0;

		for(int y = 1; y < (kBoardHeight + 3); ++y)
		{
			// update attacks
			if(y < (kBoardHeight + 2))
			{
				for(int x = 1; x < (kBoardWidth + 1); ++x)
				{
					Cell c = (*m_current)[y][x];
					if(!c.occupied)
						continue;
					int nx = x + s_directionAdj[c.direction].x;
					int ny = y + s_directionAdj[c.direction].y;
					NeighborInfo &info = ni[ny][nx];
					if(0 == info.numAttackers)
					{
						info.numAttackers = 1;
						info.strongestAttacker = c;
					} 
					else if(c.occupied && c.age > info.strongestAttacker.age)
					{
						info.numAttackers = 1;
						info.strongestAttacker = c;
					}
					else if(c.age == info.strongestAttacker.age)
					{
						info.numAttackers++;
						if(c.team != (*m_current)[ny][nx].team)
							info.strongestAttacker = c;
					}
				}
			}

			// resolve attacks (must stay 2 rows behind for results to be valid
			if(y > 1)
			{
				int ry = y - 2;
				for(int x = 1; x < (kBoardWidth + 1); ++x)
				{
					const Cell& c = (*m_current)[ry][x];
					Cell &n = (*m_next)[ry][x];
					const NeighborInfo& info = ni[ry][x];

					enum Result {
						kLives,
						kDies,
						kBirth
					};
					int result = kLives;

					if(0 == info.numAttackers)
					{
					}
					else if(1 < info.numAttackers)
					{
						if(c.team != info.strongestAttacker.team)
							result = kDies;
					}
					else if(!c.occupied)
					{
						// U gene
						uint8_t aDir = info.strongestAttacker.direction;
						result = kBirth + ((aDir + Gene(info.strongestAttacker.team).u[info.strongestAttacker.age]) % 4);
					} 
					else if(c.team != info.strongestAttacker.team)
					{
						// V gene
						uint8_t ad = info.strongestAttacker.direction;
						uint8_t dd = (c.direction - ad) % 4;
						result = kBirth + ((ad + Gene(info.strongestAttacker.team).v[dd][info.strongestAttacker.age]) % 4);
					}

					switch(result)
					{
						case kDies:
							n = cell_cast(0);
							break;
						case kLives:
							n = ageMite(c);
							break;
						default: 
						{
							n.age = 0;
							n.direction = result - kBirth;
							n.team = info.strongestAttacker.team;
							n.occupied = 1;
							break;
						}
					}

					if(!n.occupied)
						continue;

					if(0 == n.team)
						m_team0Count++;
					else
						m_team1Count++;

					if(0 == n.age)
						continue; // no need to turn

					const PacGene& gene = (kTeam0 == c.team) ? m_gene0 : m_gene1;
					int nx = x + s_directionAdj[n.direction].x;
					int ny = ry + s_directionAdj[n.direction].y;
					if(nx == -1 || nx == (kBoardWidth + 1) || ny == -1 || ny == (kBoardHeight + 1))
					{
						// W gene
						n.direction = (n.direction + gene.w[c.age]) % 4;
						continue;
					}
					const Cell& facing = (*m_current)[ny][nx];
					if(!facing.occupied)
					{
						// X gene
						n.direction = (n.direction + gene.x[c.age]) % 4;
						continue;
					}
					uint8_t dd = (n.direction - facing.direction) % 4;
					if(n.team == facing.team)
					{
						// Y gene
						n.direction = (n.direction + gene.y[dd][c.age]) % 4;
						continue;
					}
					else
					{
						// Z gene
						n.direction = (n.direction + gene.z[dd][c.age]) % 4;
						continue;
					}
				}
			}
		}

		std::swap(m_current, m_next);
	}

	uint32_t Team0Count() const { return m_team0Count; }
	uint32_t Team1Count() const { return m_team1Count; }
};

int main()
{
	PacWarSimulator sim("11111111111111111111111111111111111111111111111111", "33333333333333333333333333333333333333333333333333");
	
	printf("%3d: team1 %3u, team2 %3u\n", 1, sim.Team0Count(), sim.Team1Count());
	for(uint32_t i = 1; i <= 500; ++i)
	{
		sim.Step();
		printf("%3d: team1 %3u, team2 %3u\n", i+1, sim.Team0Count(), sim.Team1Count());
		if(0 == sim.Team0Count() || 0 == sim.Team1Count())
			break;
	}

    return 0;
}

