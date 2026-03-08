import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface SmartTitleProps {
  title: string;
  /** Max lines when collapsed. Default 2. */
  maxLines?: number;
  /** Optional class names for the text (e.g. theme text color, font size). */
  className?: string;
  /** If true, tapping toggles expanded state. Default true when title is long. */
  expandable?: boolean;
  /** Force show as single line with ellipsis (no expand). */
  singleLine?: boolean;
}

const TRUNCATE_LENGTH = 50;

/**
 * Renders a title with smart truncation. If the title is long and expandable,
 * tapping toggles between truncated and full text.
 */
export function SmartTitle({
  title,
  maxLines = 2,
  className = 'text-white',
  expandable = true,
  singleLine = false,
}: SmartTitleProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = title.length > TRUNCATE_LENGTH;
  const canExpand = expandable && isLong;
  const lines = singleLine ? 1 : expanded ? undefined : maxLines;

  const content = (
    <Text
      className={className}
      numberOfLines={lines}
      ellipsizeMode="tail"
    >
      {title}
    </Text>
  );

  if (canExpand) {
    return (
      <TouchableOpacity
        onPress={() => setExpanded((e) => !e)}
        activeOpacity={0.8}
      >
        {content}
        <Text className="text-primary text-xs font-semibold mt-1">
          {expanded ? 'Show less' : 'Show more'}
        </Text>
      </TouchableOpacity>
    );
  }

  return content;
}
