export type Point = { latitude: number; longitude: number };
export type MapMarker = Point & { title?: string; color?: string };
export type MapProps = {
  markers: MapMarker[];
  route?: Point[];
  onPick?: (point: Point) => void;
  height?: number;
};
