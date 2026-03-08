import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
  StyleSheet,
} from 'react-native';
import MalClient, {
  ForumTopicResponse,
  ForumPost,
  ForumPoll,
} from '../utils/malClient';
import { RichContent } from '@/content/rich-text';
import { useThemeColors } from '@/hooks/useThemeColors';
import { get, set } from '@/cache';
import { fetchWithStaleFallback } from '@/cache/fetchWithSourceHealth';
import { markRateLimited } from '@/cache/source/sourceHealth';

export type TopicSortOrder = 'oldest' | 'newest';

interface TopicDetailsScreenProps {
  topicId: number;
  hideTitle?: boolean;
}

function formatTimeAgo(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 2592000) return `${Math.floor(sec / 86400)}d ago`;
  if (sec < 31536000) return `${Math.floor(sec / 2592000)}mo ago`;
  return `${Math.floor(sec / 31536000)}y ago`;
}

/** Detect "replying to X" from BBCode [quote="X"] or [quote author="X"] in body */
function getReplyTo(body: string): string | null {
  if (!body || typeof body !== 'string') return null;
  const quoted = body.match(/\[quote\s*(?:=\s*["']([^"']+)["']|author\s*=\s*["']?([^"'\]]+)["']?)\s*\]/i);
  if (quoted) return (quoted[1] || quoted[2] || '').trim() || null;
  const alt = body.match(/\[quote\s+([^\]"]+)\s*\]/i);
  return alt ? alt[1].trim() : null;
}

/** MAL may expose pinned posts; support common field names */
function isPinnedPost(post: ForumPost): boolean {
  const p = post as ForumPost & { pinned?: boolean; is_pinned?: boolean };
  return p.pinned === true || p.is_pinned === true;
}

function sortPostsForDisplay(
  posts: ForumPost[],
  sortOrder: TopicSortOrder
): ForumPost[] {
  const opPost = posts.find((p) => p.number === 1);
  const pinned = posts.filter(isPinnedPost);
  const rest = posts.filter(
    (p) => p.number !== 1 && !isPinnedPost(p)
  );
  const sortedRest = [...rest].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return sortOrder === 'oldest' ? ta - tb : tb - ta;
  });
  return [...pinned, ...(opPost ? [opPost] : []), ...sortedRest];
}

interface CommentRowProps {
  post: ForumPost;
  opUsername: string | null;
  textClass: string;
  subtextClass: string;
}

const CommentRow = React.memo(function CommentRow({
  post,
  opUsername,
  textClass,
  subtextClass,
}: CommentRowProps) {
  const replyTo = getReplyTo(post.body);
  const isOP = opUsername != null && post.created_by?.name === opUsername;
  return (
    <View
      style={[
        styles.commentRow,
        replyTo && styles.commentRowReply,
      ]}
    >
      {replyTo ? (
        <View style={styles.replyBar} />
      ) : null}
      <View style={[styles.commentMain, replyTo && styles.commentMainIndent]}>
        <View style={styles.commentHeaderRow}>
          <View style={styles.avatarWrap}>
            {post.created_by?.forum_avator ? (
              <Image
                source={{ uri: post.created_by.forum_avator }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>
                  {(post.created_by?.name || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.commentMeta}>
            <Text className={`${textClass} font-semibold`} style={styles.authorName}>
              {post.created_by?.name || 'Anonymous'}
            </Text>
            {isOP ? (
              <View style={styles.opBadge}>
                <Text style={styles.opBadgeText}>OP</Text>
              </View>
            ) : null}
            <Text className={subtextClass} style={styles.time}>
              {formatTimeAgo(post.created_at)}
            </Text>
          </View>
        </View>
        {replyTo ? (
          <Text className={subtextClass} style={styles.replyToLine}>
            Replying to <Text style={styles.replyToName}>@{replyTo}</Text>
          </Text>
        ) : null}
        <View className={subtextClass} style={styles.commentText}>
          <RichContent content={post.body} source="mal-forum" />
        </View>
      </View>
    </View>
  );
});

const TopicDetailsScreen = ({ topicId, hideTitle }: TopicDetailsScreenProps) => {
  const [loading, setLoading] = useState(true);
  const [topicDetails, setTopicDetails] = useState<ForumTopicResponse | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [totalPosts, setTotalPosts] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<TopicSortOrder>('oldest');
  const { text, subtext, cardBg, border } = useThemeColors();
  const malClient = useMemo(() => new MalClient(), []);

  const displayedPosts = useMemo(
    () => sortPostsForDisplay(posts, sortOrder),
    [posts, sortOrder]
  );

  const fetchTopicDetails = async (url?: string) => {
    setLoading(true);
    const isInitial = !url;
    const cacheKey = isInitial
      ? `topic_${topicId}`
      : (() => {
          try {
            const u = new URL(url!);
            const offset = u.searchParams.get('offset') ?? '';
            return `topic_${topicId}_o${offset || 'next'}`;
          } catch {
            return `topic_${topicId}_next`;
          }
        })();

    type CachedTopic = { response?: ForumTopicResponse; posts?: ForumPost[]; nextPage?: string | null; total?: number };

    const getCached = async (): Promise<CachedTopic | null> => {
      const c = await get('MAL_FORUM_TOPIC', cacheKey);
      return c as CachedTopic | null;
    };

    if (isInitial) {
      const cached = await getCached();
      if (cached?.posts && (cached.response || cached.posts.length > 0)) {
        if (cached.response) setTopicDetails(cached.response);
        setPosts(cached.posts ?? []);
        setNextPage(cached.nextPage ?? null);
        if (typeof cached.total === 'number') setTotalPosts(cached.total);
        setLoading(false);
        return;
      }
    } else {
      const cached = await getCached();
      if (cached?.posts && cached.posts.length > 0) {
        setPosts((prev) => [...(Array.isArray(prev) ? prev : []), ...cached.posts!]);
        if (cached.nextPage != null) setNextPage(cached.nextPage);
        if (typeof cached.total === 'number') setTotalPosts(cached.total);
        setLoading(false);
        return;
      }
    }

    const fetcher = async (): Promise<CachedTopic> => {
      try {
        const response = url
          ? await malClient.apiClient.get(url)
          : await malClient.getTopicDetails(topicId, ['poll'], 25);
        const body = response?.data ?? response;
        const posts = body?.data?.posts ?? body?.posts ?? [];
        const paging = body?.paging ?? response?.paging;
        const nextPage = paging?.next ?? null;
        const total = typeof (paging?.total ?? body?.total) === 'number' ? (paging?.total ?? body?.total) : undefined;
        const data: CachedTopic = { response: isInitial ? (response as ForumTopicResponse) : undefined, posts, nextPage, total };
        await set('MAL_FORUM_TOPIC', cacheKey, data);
        return data;
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 429) markRateLimited('mal', 60 * 1000);
        throw e;
      }
    };

    try {
      const data = await fetchWithStaleFallback(
        getCached,
        fetcher,
        { source: 'mal', allowStaleOnError: true, namespace: 'MAL_FORUM_TOPIC' }
      );
      if (!data) {
        setTopicDetails(null);
        setPosts([]);
        setNextPage(null);
        setTotalPosts(null);
        return;
      }
      if (isInitial && data.response) setTopicDetails(data.response);
      const newPosts = data.posts ?? [];
      if (isInitial) {
        setPosts(Array.isArray(newPosts) ? newPosts : []);
      } else {
        setPosts((prev) => [...(Array.isArray(prev) ? prev : []), ...newPosts]);
      }
      if (data.nextPage != null) setNextPage(data.nextPage);
      if (typeof data.total === 'number') setTotalPosts(data.total);
    } catch {
      setTopicDetails(null);
      setPosts([]);
      setNextPage(null);
      setTotalPosts(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopicDetails();
  }, [topicId]);

  const renderPoll = (poll: ForumPoll) => {
    const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
    return (
      <View className={`${cardBg} rounded-xl mb-4 border ${border}`} style={styles.pollCard}>
        <View style={styles.pollHeader}>
          <Text className={`${subtext} text-xs font-semibold uppercase tracking-wide`} style={styles.pollLabel}>
            Poll
          </Text>
          <View style={[styles.pollStatusBadge, poll.closed && styles.pollStatusClosed]}>
            <Text style={[styles.pollStatusText, poll.closed && styles.pollStatusClosedText]}>
              {poll.closed ? 'Closed' : 'Open'}
            </Text>
          </View>
        </View>
        <Text className={`${text} font-semibold`} style={styles.pollQuestion}>
          {poll.question}
        </Text>
        <View style={styles.pollOptions}>
          {poll.options.map((option) => {
            const pct = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
            return (
              <View key={option.id} style={styles.pollOptionRow}>
                <View style={styles.pollOptionBarBg}>
                  <View style={[styles.pollOptionBarFill, { width: `${pct}%` }]} />
                </View>
                <View style={styles.pollOptionContent}>
                  <Text className={`${text} text-sm`} style={styles.pollOptionText} numberOfLines={2}>
                    {option.text}
                  </Text>
                  <Text className="text-primary text-xs font-semibold" style={styles.pollOptionVotes}>
                    {option.votes} {option.votes === 1 ? 'vote' : 'votes'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
        {totalVotes > 0 && (
          <Text className={subtext} style={styles.pollTotal}>
            {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
          </Text>
        )}
      </View>
    );
  };

  const opPost = posts.find((p) => p.number === 1);
  const opUsername = opPost?.created_by?.name ?? null;

  const renderCommentItem = useCallback(
    ({ item }: { item: ForumPost }) => (
      <CommentRow
        post={item}
        opUsername={opUsername}
        textClass={text}
        subtextClass={subtext}
      />
    ),
    [opUsername, text, subtext]
  );

  const keyExtractor = useCallback((post: ForumPost) => String(post.id), []);

  if (loading && posts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color="#4a7c7c" />
        <Text className={`${subtext} text-sm mt-2`}>Loading comments…</Text>
      </View>
    );
  }

  if (!topicDetails && posts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text className={`${subtext} text-sm`}>Couldn't load this discussion</Text>
      </View>
    );
  }

  const listHeader = (
    <>
      {!hideTitle && (
        <Text
          className={`${text} font-bold`}
          style={styles.threadTitle}
          numberOfLines={2}
        >
          {topicDetails?.data?.title}
        </Text>
      )}
      {topicDetails?.data?.poll ? renderPoll(topicDetails.data.poll) : null}
      {posts.length > 0 ? (
        <>
          <View style={styles.commentsHeaderRow}>
            <Text className={subtext} style={styles.commentsHeading}>
              {posts.length} comment{posts.length !== 1 ? 's' : ''}
            </Text>
            <View style={styles.sortRow}>
              <Text className={subtext} style={styles.sortLabel}>Sort: </Text>
              <TouchableOpacity
                onPress={() => setSortOrder('oldest')}
                style={[styles.sortChip, sortOrder === 'oldest' && styles.sortChipActive]}
              >
                <Text
                  style={[
                    styles.sortChipText,
                    sortOrder === 'oldest' && styles.sortChipTextActive,
                  ]}
                >
                  Oldest
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSortOrder('newest')}
                style={[styles.sortChip, sortOrder === 'newest' && styles.sortChipActive]}
              >
                <Text
                  style={[
                    styles.sortChipText,
                    sortOrder === 'newest' && styles.sortChipTextActive,
                  ]}
                >
                  Newest
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text className={subtext} style={styles.sortHint}>
            OP and pinned comments stay at the top.
          </Text>
        </>
      ) : null}
    </>
  );

  const listFooter = nextPage ? (
    <TouchableOpacity
      onPress={() => fetchTopicDetails(nextPage)}
      style={styles.loadMore}
    >
      <Text className="text-primary font-semibold text-sm">
        {typeof totalPosts === 'number' && totalPosts > posts.length
          ? `Load more (${totalPosts - posts.length} more)`
          : 'Load more comments (up to 100 more)'}
      </Text>
    </TouchableOpacity>
  ) : null;

  return (
    <FlatList
      data={displayedPosts}
      renderItem={renderCommentItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      contentContainerStyle={styles.scrollContent}
      style={styles.scroll}
      showsVerticalScrollIndicator={true}
      nestedScrollEnabled={true}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={10}
    />
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
  },
  threadTitle: {
    fontSize: 15,
    marginBottom: 10,
    lineHeight: 20,
  },
  commentsHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
    gap: 8,
  },
  commentsHeading: {
    marginBottom: 0,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortLabel: {
    fontSize: 12,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(156,163,175,0.2)',
  },
  sortChipActive: {
    backgroundColor: 'rgba(74, 124, 124, 0.3)',
  },
  sortChipText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  sortChipTextActive: {
    color: '#4a7c7c',
    fontWeight: '600',
  },
  sortHint: {
    marginBottom: 8,
    fontSize: 11,
    fontStyle: 'italic',
  },
  commentRow: {
    marginBottom: 12,
  },
  commentRowReply: {
    marginLeft: 0,
  },
  replyBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(74, 124, 124, 0.4)',
  },
  commentMain: {},
  commentMainIndent: {
    marginLeft: 12,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  replyToLine: {
    fontSize: 11,
    marginBottom: 4,
  },
  replyToName: {
    color: '#4a7c7c',
    fontWeight: '600',
  },
  avatarWrap: {
    marginRight: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(74, 124, 124, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a7c7c',
  },
  commentMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    minWidth: 0,
  },
  authorName: {
    fontSize: 13,
  },
  opBadge: {
    backgroundColor: 'rgba(74, 124, 124, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  opBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4a7c7c',
    letterSpacing: 0.5,
  },
  time: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 13,
    lineHeight: 19,
  },
  loadMore: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  // Poll
  pollCard: {
    overflow: 'hidden',
    padding: 0,
  },
  pollHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(156,163,175,0.2)',
  },
  pollLabel: {
    letterSpacing: 0.8,
  },
  pollStatusBadge: {
    backgroundColor: 'rgba(74, 124, 124, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pollStatusClosed: {
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
  },
  pollStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4a7c7c',
    letterSpacing: 0.3,
  },
  pollStatusClosedText: {
    color: '#6b7280',
  },
  pollQuestion: {
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  pollOptions: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  pollOptionRow: {
    marginBottom: 12,
  },
  pollOptionBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(156,163,175,0.2)',
    overflow: 'hidden',
    marginBottom: 6,
  },
  pollOptionBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#4a7c7c',
  },
  pollOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  pollOptionText: {
    flex: 1,
    marginRight: 8,
  },
  pollOptionVotes: {
    marginLeft: 4,
  },
  pollTotal: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
  },
});

export default TopicDetailsScreen;
