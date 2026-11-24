import { Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { colour, font, layout } from '../theme';

const HEIGHT = 120;
const PADDING = 6;

/**
 * A rating over time. A line, not bars: the question is whether the number is going
 * up, and a line answers it at a glance. Scaled to its own range rather than to zero
 * so a club-sized swing of fifty points is visible.
 */
export function RatingGraph({ points }: { readonly points: readonly number[] }) {
  if (points.length < 2) {
    return <Text style={font.dim}>Two confirmed games and a line appears here.</Text>;
  }

  const low = Math.min(...points);
  const high = Math.max(...points);
  const span = high - low === 0 ? 1 : high - low;

  const plotted = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = HEIGHT - PADDING - ((value - low) / span) * (HEIGHT - PADDING * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View style={{ gap: 4 }}>
      <Svg
        height={HEIGHT}
        preserveAspectRatio="none"
        viewBox={`0 0 100 ${HEIGHT}`}
        width="100%"
      >
        <Line
          stroke={colour.line}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          x1={0}
          x2={100}
          y1={HEIGHT - PADDING}
          y2={HEIGHT - PADDING}
        />
        <Polyline
          fill="none"
          points={plotted}
          stroke={colour.accent}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
      <View style={layout.spread}>
        <Text style={font.dim}>{`low ${low}`}</Text>
        <Text style={font.dim}>{`${points.length} games`}</Text>
        <Text style={font.dim}>{`high ${high}`}</Text>
      </View>
    </View>
  );
}
