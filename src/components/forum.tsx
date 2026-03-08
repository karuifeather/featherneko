import { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  StyleSheet,
} from 'react-native';
import axios from 'axios';
import { AnimeClient, JikanForum } from '@tutkli/jikan-ts';
import TopicDetailsScreen from './topic';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faComment, faChevronRight, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { get, set } from '@/cache';
import { fetchWithStaleFallback } from '@/cache/fetchWithSourceHealth';
import { markRateLimited } from '@/cache/source/sourceHealth';

type ForumFilter = 'all' | 'episode' | 'other';

/** Pinned row for "this episode" so it's always tappable even when not in the API's short list. */
export interface PinnedForumItem {
  mal_id: number;
  title: string;
  isPinned: true;
}

interface ForumProps {
  id: number;
  filter: ForumFilter;
  /** When set (e.g. from watch-episode), drawer top aligns with bottom of player for watch-while-read. */
  drawerTopOffset?: number;
  /** When set, opens the drawer to this MAL forum topic (e.g. current episode discussion). */
  initialTopicId?: number | null;
  /** Title for the drawer when the topic is not in the list (e.g. "Episode 3 Discussion"). */
  initialTopicTitle?: string;
  /** When true, show "Comments" header and pin current episode at top (Comments tab UX). */
  commentsMode?: boolean;
  /** Called when the discussion drawer opens or closes (so parent can e.g. show tap-to-close overlay). */
  onDrawerOpenChange?: (open: boolean) => void;
}

export interface AnimeForumRef {
  /** Close the discussion drawer (e.g. when user taps on video). */
  closeDrawer: () => void;
}

const animeClient = new AnimeClient();
const JIKAN_BASE = 'https://api.jikan.moe/v4';

/** Fetch a single page of forum topics from Jikan API. */
async function fetchForumPageFromApi(
  malId: number,
  filter: ForumFilter,
  page: number
): Promise<JikanForum[]> {
  const { data } = await axios.get<{ data: JikanForum[] }>(
    `${JIKAN_BASE}/anime/${malId}/forum`,
    { params: { filter, page } }
  );
  return Array.isArray(data?.data) ? data.data : [];
}

function formatTimeAgo(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 2592000) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString();
}

type ForumListEntry = JikanForum | PinnedForumItem;

function isPinned(item: ForumListEntry): item is PinnedForumItem {
  return 'isPinned' in item && item.isPinned === true;
}

const AnimeForum = forwardRef<AnimeForumRef, ForumProps>(function AnimeForum({
  id,
  filter,
  drawerTopOffset = 0,
  initialTopicId,
  initialTopicTitle,
  commentsMode = false,
  onDrawerOpenChange,
}, ref) {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [forums, setForums] = useState<JikanForum[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedForumId, setSelectedForumId] = useState<number | null>(null);
  const { bg, text, subtext, border } = useThemeColors();

  useImperativeHandle(ref, () => ({
    closeDrawer: () => setSelectedForumId(null),
  }), []);

  useEffect(() => {
    onDrawerOpenChange?.(selectedForumId !== null);
    return () => onDrawerOpenChange?.(false);
  }, [selectedForumId, onDrawerOpenChange]);

  const fetchForums = async (pageNum: number = 1, append: boolean = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    const cacheKey = `${id}_${filter}_${pageNum}`;

    const getCached = async (): Promise<JikanForum[] | null> => {
      const c = await get('JIKAN_FORUM_LIST', cacheKey);
      return Array.isArray(c) ? (c as JikanForum[]) : null;
    };

    const cached = await getCached();
    if (cached !== null) {
      if (append) {
        setForums((prev) => {
          const existingIds = new Set(prev.map((f) => f.mal_id));
          const newItems = cached.filter((f) => !existingIds.has(f.mal_id));
          setHasMore(newItems.length > 0 && cached.length >= 15);
          return [...prev, ...newItems];
        });
      } else {
        setForums(cached);
        setHasMore(cached.length >= 15);
      }
      setPage(pageNum);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const fetcher = async (): Promise<JikanForum[]> => {
      try {
        const data = await fetchForumPageFromApi(id, filter, pageNum);
        await set('JIKAN_FORUM_LIST', cacheKey, data);
        return data;
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 429) markRateLimited('jikan', 60 * 1000);
        throw e;
      }
    };

    try {
      const data = await fetchWithStaleFallback(
        getCached,
        fetcher,
        { source: 'jikan', allowStaleOnError: true, namespace: 'JIKAN_FORUM_LIST' }
      );
      const list = data ?? [];
      if (append) {
        setForums((prev) => {
          const existingIds = new Set(prev.map((f) => f.mal_id));
          const newItems = list.filter((f) => !existingIds.has(f.mal_id));
          setHasMore(newItems.length > 0 && list.length >= 15);
          return [...prev, ...newItems];
        });
      } else {
        setForums(list);
        setHasMore(list.length >= 15);
      }
      setPage(pageNum);
    } catch {
      if (!append) setForums([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreTopics = () => {
    if (loadingMore || !hasMore) return;
    fetchForums(page + 1, true);
  };

  useEffect(() => {
    setSelectedForumId(null);
    setPage(1);
    setHasMore(true);
    fetchForums(1, false);
  }, [id, filter]);

  // Do not auto-open drawer from initialTopicId; user opens it by tapping the pinned row

  if (loading && forums.length === 0) {
    return (
      <View className={`flex-1 justify-center items-center ${bg}`} style={{ minHeight: 120 }}>
        <ActivityIndicator size="small" color="#4a7c7c" />
        <Text className={`${subtext} text-sm mt-2`}>Loading discussions…</Text>
      </View>
    );
  }

  const pinnedItem: PinnedForumItem | null =
    initialTopicId != null && initialTopicTitle
      ? { mal_id: initialTopicId, title: initialTopicTitle, isPinned: true }
      : null;

  const alreadyInList = pinnedItem && forums.some((f) => f.mal_id === pinnedItem.mal_id);
  const listData: ForumListEntry[] =
    pinnedItem && !alreadyInList ? [pinnedItem, ...forums] : forums;

  if (listData.length === 0) {
    return (
      <View className={`flex-1 justify-center items-center ${bg}`} style={{ minHeight: 120 }}>
        <FontAwesomeIcon icon={faComment} size={28} color="#6b7280" />
        <Text className={`${subtext} text-sm mt-2`}>No discussions yet</Text>
      </View>
    );
  }

  const selectedForum = forums.find((f) => f.mal_id === selectedForumId);
  const drawerTitle =
    selectedForum?.title ?? (selectedForumId != null ? initialTopicTitle ?? 'Discussion' : null);

  const renderTopicRow = ({ item }: { item: ForumListEntry }) => {
    const isSelected = selectedForumId === item.mal_id;
    if (isPinned(item)) {
      return (
        <TouchableOpacity
          onPress={() => setSelectedForumId(item.mal_id)}
          activeOpacity={0.7}
          style={[styles.topicRow, styles.pinnedRow, isSelected && styles.topicRowSelected]}
        >
          <View style={styles.pinnedIconCircle}>
            <FontAwesomeIcon icon={faComment} size={16} color="#4a7c7c" />
          </View>
          <View style={styles.topicBody}>
            <Text
              className={`${text} font-semibold`}
              style={styles.topicTitle}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {item.title}
            </Text>
            <Text className={subtext} style={styles.meta}>
              This episode · Tap to view discussion
            </Text>
          </View>
          <FontAwesomeIcon icon={faChevronRight} size={12} color="#9ca3af" />
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        onPress={() => setSelectedForumId(item.mal_id)}
        activeOpacity={0.7}
        style={[styles.topicRow, isSelected && styles.topicRowSelected]}
      >
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {(item.title || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.topicBody}>
          <Text
            className={`${text} font-semibold`}
            style={styles.topicTitle}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {item.title}
          </Text>
          <Text className={subtext} style={styles.meta}>
            {item.author_username}
            {' · '}
            {formatTimeAgo(item.date)}
          </Text>
        </View>
        <View style={styles.right}>
          <Text className={subtext} style={styles.commentCount}>
            {item.comments} {item.comments === 1 ? 'comment' : 'comments'}
          </Text>
          <FontAwesomeIcon icon={faChevronRight} size={12} color="#9ca3af" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className={`flex-1 ${bg}`}>
      <View style={styles.header}>
        <Text className={`${text} font-bold`} style={styles.headerTitle}>
          {commentsMode ? 'Comments' : 'Discussion'}
        </Text>
        <Text className={subtext} style={styles.headerCount}>
          {commentsMode && pinnedItem
            ? `${listData.length} topic${listData.length !== 1 ? 's' : ''}`
            : `${forums.length} topic${forums.length !== 1 ? 's' : ''}`}
        </Text>
      </View>
      {commentsMode && pinnedItem ? (
        <Text className={`${subtext} text-sm px-4 pb-2`} style={{ marginTop: -4 }}>
          This episode&apos;s discussion is pinned at the top.
        </Text>
      ) : null}
      <FlatList
        data={listData}
        renderItem={renderTopicRow}
        keyExtractor={(item) => (isPinned(item) ? `forum-pinned-${item.mal_id}` : `forum-${item.mal_id}`)}
        contentContainerStyle={styles.topicListContent}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { borderBottomColor: 'rgba(156,163,175,0.25)' }]} />
        )}
        ListFooterComponent={
          hasMore && listData.length > 0 ? (
            <TouchableOpacity
              onPress={loadMoreTopics}
              disabled={loadingMore}
              style={styles.loadMoreTopics}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color="#4a7c7c" />
              ) : (
                <Text className="text-primary font-semibold text-sm">
                  Load more topics
                </Text>
              )}
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Drawer: selected discussion; when drawerTopOffset set, sheet starts at bottom of player */}
      <Modal
        visible={selectedForumId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedForumId(null)}
      >
        <View style={styles.drawerContainer}>
          <View
            style={[
              styles.drawerBackdropOnly,
              drawerTopOffset > 0 && { top: drawerTopOffset },
            ]}
          />
          <View
            style={[
              styles.drawerSheet,
              drawerTopOffset > 0 && styles.drawerSheetAlignedToPlayer,
              drawerTopOffset > 0 && { top: drawerTopOffset },
            ]}
          >
            <View className={bg} style={styles.drawerSheetInner}>
              <View style={styles.drawerHandle} />
              <View style={styles.drawerHeader}>
                <View style={styles.drawerHeaderText}>
                  <Text
                    className={`${text} font-bold`}
                    style={styles.drawerTitle}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {drawerTitle ?? 'Discussion'}
                  </Text>
                  {selectedForum?.author_username ? (
                    <Text className={subtext} style={styles.drawerStartedBy}>
                      Started by @{selectedForum.author_username}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedForumId(null)}
                  hitSlop={12}
                  style={styles.drawerCloseBtn}
                >
                  <FontAwesomeIcon icon={faTimes} size={18} color="#4a7c7c" />
                </TouchableOpacity>
              </View>
              {selectedForumId !== null ? (
                <View style={styles.drawerBody}>
                  <View style={styles.drawerScrollWrap}>
                    <TopicDetailsScreen topicId={selectedForumId} hideTitle />
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
  },
  headerCount: {
    fontSize: 13,
  },
  topicListContent: {
    paddingBottom: 24,
  },
  loadMoreTopics: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  pinnedRow: {
    backgroundColor: 'rgba(74, 124, 124, 0.08)',
  },
  topicRowSelected: {
    backgroundColor: 'rgba(74, 124, 124, 0.12)',
  },
  pinnedIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(74, 124, 124, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(74, 124, 124, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a7c7c',
  },
  topicBody: {
    flex: 1,
    minWidth: 0,
  },
  topicTitle: {
    fontSize: 15,
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  commentCount: {
    fontSize: 13,
  },
  separator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginLeft: 68,
  },
  drawerContainer: {
    flex: 1,
  },
  drawerBackdropOnly: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  drawerSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    minHeight: 320,
  },
  drawerSheetAlignedToPlayer: {
    maxHeight: undefined,
    minHeight: undefined,
    bottom: 0,
    top: undefined,
  },
  drawerSheetInner: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  drawerHandle: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(156,163,175,0.45)',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(156,163,175,0.25)',
  },
  drawerHeaderText: {
    flex: 1,
    marginRight: 8,
  },
  drawerTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  drawerStartedBy: {
    fontSize: 11,
    marginTop: 2,
  },
  drawerCloseBtn: {
    padding: 6,
    marginTop: -2,
    marginRight: -6,
  },
  drawerBody: {
    flex: 1,
    minHeight: 0,
  },
  drawerScrollWrap: {
    flex: 1,
    minHeight: 0,
  },
});

export default AnimeForum;
