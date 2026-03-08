import React, { useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';

interface ExpandableDescriptionProps {
  text: string;
  /** Max lines when collapsed. Default 3. */
  maxLines?: number;
  /** Class for main text (e.g. theme subtext). */
  textClassName?: string;
  /** Class for "Read more / Read less" link. */
  linkClassName?: string;
  /** If false, always show full text (no truncation). */
  collapsible?: boolean;
}

const MIN_LENGTH_TO_COLLAPSE = 120;

/**
 * Description that shows a limited number of lines with "Read more" / "Read less".
 */
export function ExpandableDescription({
  text,
  maxLines = 3,
  textClassName = 'text-gray-400',
  linkClassName = 'text-primary font-semibold',
  collapsible = true,
}: ExpandableDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = collapsible && (text?.length ?? 0) > MIN_LENGTH_TO_COLLAPSE;

  if (!text?.trim()) {
    return <Text className={textClassName}>No description available.</Text>;
  }

  return (
    <TouchableOpacity
      onPress={() => shouldCollapse && setExpanded((e) => !e)}
      activeOpacity={shouldCollapse ? 0.7 : 1}
      disabled={!shouldCollapse}
    >
      <Text
        className={textClassName}
        numberOfLines={shouldCollapse && !expanded ? maxLines : undefined}
        ellipsizeMode="tail"
      >
        {text}
      </Text>
      {shouldCollapse && (
        <Text className={`text-xs mt-0.5 ${linkClassName}`}>
          {expanded ? 'Read less' : 'Read more'}
        </Text>
      )}
    </TouchableOpacity>
  );
}
