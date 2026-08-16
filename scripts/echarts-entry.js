import * as echarts from "echarts/core";
import { HeatmapChart, LineChart, PieChart, SankeyChart } from "echarts/charts";
import {
  AriaComponent,
  CalendarComponent,
  DataZoomComponent,
  GridComponent,
  TooltipComponent,
  VisualMapComponent
} from "echarts/components";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { SVGRenderer } from "echarts/renderers";

echarts.use([
  LineChart,
  PieChart,
  HeatmapChart,
  SankeyChart,
  AriaComponent,
  CalendarComponent,
  DataZoomComponent,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  LabelLayout,
  UniversalTransition,
  SVGRenderer
]);

globalThis.UPAECharts = { init: echarts.init, graphic: echarts.graphic, connect: echarts.connect };
