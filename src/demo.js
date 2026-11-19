/* Demo project: Mr Mbaka residence first floor framing (walls from the first-floor plan) */
function demoProject() {
  const J = {
    grid_x_mm: [-1800, 0, 4950, 6400, 8850, 11800, 13300],
    grid_y_mm: [0, 3950, 6500, 8000, 9800],
    walls: [
      { dir: "h", y_mm: 0, x1_mm: 0, x2_mm: 11800 }, { dir: "h", y_mm: 9800, x1_mm: 0, x2_mm: 11800 },
      { dir: "v", x_mm: 0, y1_mm: 0, y2_mm: 9800 }, { dir: "v", x_mm: 11800, y1_mm: 0, y2_mm: 9800 },
      { dir: "h", y_mm: 3950, x1_mm: 0, x2_mm: 11800 }, { dir: "h", y_mm: 6500, x1_mm: 0, x2_mm: 8850 },
      { dir: "v", x_mm: 4950, y1_mm: 0, y2_mm: 3950 }, { dir: "v", x_mm: 4950, y1_mm: 6500, y2_mm: 9800 },
      { dir: "v", x_mm: 8850, y1_mm: 0, y2_mm: 9800 }, { dir: "v", x_mm: 6400, y1_mm: 3950, y2_mm: 9800 },
      { dir: "h", y_mm: 8000, x1_mm: 8850, x2_mm: 11800 }
    ],
    voids: [{ x1_mm: 6400, y1_mm: 6500, x2_mm: 8850, y2_mm: 9800, label: "stair" }],
    balconies: [{ x1_mm: -1800, y1_mm: 0, x2_mm: 0, y2_mm: 3950 }, { x1_mm: 11800, y1_mm: 0, x2_mm: 13300, y2_mm: 3950 }],
    outside: [{ x1_mm: -1800, y1_mm: 3950, x2_mm: 0, y2_mm: 9800 }, { x1_mm: 11800, y1_mm: 3950, x2_mm: 13300, y2_mm: 9800 }],
    rooms: [{ name: "Master bedroom", x_mm: 2400, y_mm: 2000 }, { name: "Ensuite / WIC", x_mm: 6900, y_mm: 2000 }, { name: "Master lounge", x_mm: 10300, y_mm: 2000 },
            { name: "Family room", x_mm: 3200, y_mm: 5200 }, { name: "Landing", x_mm: 7600, y_mm: 5200 }, { name: "Bedroom 2", x_mm: 10300, y_mm: 5800 },
            { name: "Cinema", x_mm: 2400, y_mm: 8200 }, { name: "Powder", x_mm: 5650, y_mm: 8200 }, { name: "Stair", x_mm: 7600, y_mm: 8200 }, { name: "Ensuite", x_mm: 10300, y_mm: 8900 }]
  };
  const below = [ // ground-floor walls (same origin)
    { dir: "h", y_mm: 0, x1_mm: 0, x2_mm: 11800 }, { dir: "h", y_mm: 9800, x1_mm: 0, x2_mm: 11800 },
    { dir: "v", x_mm: 0, y1_mm: 0, y2_mm: 9800 }, { dir: "v", x_mm: 11800, y1_mm: 0, y2_mm: 9800 },
    { dir: "v", x_mm: 6400, y1_mm: 0, y2_mm: 5200 }, { dir: "h", y_mm: 2900, x1_mm: 6400, x2_mm: 11800 },
    { dir: "h", y_mm: 3600, x1_mm: 0, x2_mm: 6400 }, { dir: "h", y_mm: 5100, x1_mm: 6400, x2_mm: 11800 },
    { dir: "h", y_mm: 5700, x1_mm: 0, x2_mm: 4700 }, { dir: "v", x_mm: 4800, y1_mm: 5700, y2_mm: 9800 },
    { dir: "v", x_mm: 6500, y1_mm: 6400, y2_mm: 9800 }, { dir: "v", x_mm: 8900, y1_mm: 6300, y2_mm: 9800 },
    { dir: "h", y_mm: 6400, x1_mm: 8900, x2_mm: 11800 }
  ];
  return { J, below };
}
if (typeof module !== "undefined") module.exports = demoProject;
