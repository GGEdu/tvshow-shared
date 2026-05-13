import { MEDIA_TYPE_MAP, SERIES_STATUS_MAP, STATUS_CONFIG } from "../../lib/constants.js";

const colorMap = {
  "tvt-yellow": "bg-tvt-yellow/20 text-tvt-yellow",
  "tvt-blue": "bg-tvt-blue/20 text-tvt-blue",
  "tvt-purple": "bg-tvt-purple/20 text-tvt-purple",
  "tvt-red": "bg-tvt-red/20 text-tvt-red",
  "tvt-green": "bg-tvt-green/20 text-tvt-green",
};

export default function Badge({ variant, seriesStatus, mediaType, className = "" }) {
  let label, color;

  if (variant && STATUS_CONFIG[variant]) {
    label = STATUS_CONFIG[variant].label;
    color = STATUS_CONFIG[variant].color;
  } else if (mediaType && MEDIA_TYPE_MAP[mediaType]) {
    label = MEDIA_TYPE_MAP[mediaType].label;
    color = MEDIA_TYPE_MAP[mediaType].color;
  } else if (seriesStatus && SERIES_STATUS_MAP[seriesStatus]) {
    label = SERIES_STATUS_MAP[seriesStatus].label;
    color = SERIES_STATUS_MAP[seriesStatus].color;
  } else if (seriesStatus) {
    label = seriesStatus;
    color = "tvt-blue";
  } else {
    return null;
  }

  return (
    <span
      className={[
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        colorMap[color] ?? "bg-surface-overlay text-text-secondary",
        className,
      ].join(" ")}
    >
      {label}
    </span>
  );
}
