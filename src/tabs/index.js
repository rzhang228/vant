import { createNamespace, isDef, addUnit } from '../utils';
import { scrollLeftTo, scrollTopTo } from './utils';
import { route } from '../utils/router';
import { isHidden } from '../utils/dom/style';
import { on, off } from '../utils/dom/event';
import { ParentMixin } from '../mixins/relation';
import { BindEventMixin } from '../mixins/bind-event';
import { BORDER_TOP_BOTTOM } from '../utils/constant';
import { setRootScrollTop, getElementTop, getVisibleHeight, getVisibleTop } from '../utils/dom/scroll';
import Title from './Title';
import Content from './Content';
import Sticky from '../sticky';

const [createComponent, bem] = createNamespace('tabs');

export default createComponent({
  mixins: [
    ParentMixin('vanTabs'),
    BindEventMixin(function(bind) {
      bind(window, 'resize', this.resize, true);
      if (this.scrollspy) {
        bind(window, 'scroll', this.onScrollspyScroll, true);
      }
    })
  ],

  model: {
    prop: 'active'
  },

  props: {
    color: String,
    sticky: Boolean,
    animated: Boolean,
    swipeable: Boolean,
    scrollspy: Boolean,
    background: String,
    lineWidth: [Number, String],
    lineHeight: [Number, String],
    titleActiveColor: String,
    titleInactiveColor: String,
    type: {
      type: String,
      default: 'line'
    },
    active: {
      type: [Number, String],
      default: 0
    },
    border: {
      type: Boolean,
      default: true
    },
    ellipsis: {
      type: Boolean,
      default: true
    },
    duration: {
      type: Number,
      default: 0.3
    },
    offsetTop: {
      type: Number,
      default: 0
    },
    lazyRender: {
      type: Boolean,
      default: true
    },
    swipeThreshold: {
      type: Number,
      default: 4
    }
  },

  data() {
    return {
      position: '',
      currentIndex: null,
      lineStyle: {
        backgroundColor: this.color
      }
    };
  },

  computed: {
    // whether the nav is scrollable
    scrollable() {
      return this.children.length > this.swipeThreshold || !this.ellipsis;
    },

    navStyle() {
      return {
        borderColor: this.color,
        background: this.background
      };
    },

    currentName() {
      const activeTab = this.children[this.currentIndex];

      if (activeTab) {
        return activeTab.computedName;
      }
    },

    scrollOffset() {
      if (this.sticky) {
        return this.offsetTop + this.tabHeight;
      }
      return 0;
    }
  },

  watch: {
    color: 'setLine',

    active(name) {
      if (name !== this.currentName) {
        this.setCurrentIndexByName(name);
      }
    },

    children() {
      this.setCurrentIndexByName(this.currentName || this.active);
      this.setLine();

      this.$nextTick(() => {
        this.scrollIntoView(true);
      });
    },

    currentIndex() {
      this.scrollIntoView();
      this.setLine();

      // scroll to correct position
      if (this.stickyFixed && !this.scrollspy) {
        setRootScrollTop(Math.ceil(getElementTop(this.$el) - this.offsetTop));
      }
    },

    scrollspy(val) {
      if (val) {
        on(window, 'scroll', this.onScrollspyScroll, true);
      } else {
        off(window, 'scroll', this.onScrollspyScroll);
      }
    }
  },

  mounted() {
    this.onShow();
  },

  activated() {
    this.onShow();
    this.setLine();
  },

  methods: {
    // @exposed-api
    resize() {
      this.setLine();
    },

    onShow() {
      this.$nextTick(() => {
        this.inited = true;
        this.tabHeight = getVisibleHeight(this.$refs.wrap);
        this.scrollIntoView(true);
      });
    },

    // update nav bar style
    setLine() {
      const shouldAnimate = this.inited;

      this.$nextTick(() => {
        const { titles } = this.$refs;

        if (
          !titles ||
          !titles[this.currentIndex] ||
          this.type !== 'line' ||
          isHidden(this.$el)
        ) {
          return;
        }

        const title = titles[this.currentIndex].$el;
        const { lineWidth, lineHeight } = this;
        const width = isDef(lineWidth) ? lineWidth : title.offsetWidth / 2;
        const left = title.offsetLeft + title.offsetWidth / 2;

        const lineStyle = {
          width: addUnit(width),
          backgroundColor: this.color,
          transform: `translateX(${left}px) translateX(-50%)`
        };

        if (shouldAnimate) {
          lineStyle.transitionDuration = `${this.duration}s`;
        }

        if (isDef(lineHeight)) {
          const height = addUnit(lineHeight);
          lineStyle.height = height;
          lineStyle.borderRadius = height;
        }

        this.lineStyle = lineStyle;
      });
    },

    // correct the index of active tab
    setCurrentIndexByName(name) {
      const matched = this.children.filter(tab => tab.computedName === name);
      const defaultIndex = (this.children[0] || {}).index || 0;
      this.setCurrentIndex(matched.length ? matched[0].index : defaultIndex);
    },

    setCurrentIndex(currentIndex) {
      currentIndex = this.findAvailableTab(currentIndex);

      if (isDef(currentIndex) && currentIndex !== this.currentIndex) {
        const shouldEmitChange = this.currentIndex !== null;
        this.currentIndex = currentIndex;
        this.$emit('input', this.currentName);

        if (shouldEmitChange) {
          this.$emit(
            'change',
            this.currentName,
            this.children[currentIndex].title
          );
        }
      }
    },

    findAvailableTab(index) {
      const diff = index < this.currentIndex ? -1 : 1;

      while (index >= 0 && index < this.children.length) {
        if (!this.children[index].disabled) {
          return index;
        }

        index += diff;
      }
    },

    // emit event when clicked
    onClick(index) {
      const { title, disabled, computedName } = this.children[index];
      if (disabled) {
        this.$emit('disabled', computedName, title);
      } else {
        this.setCurrentIndex(index);
        this.scrollToCurrentContent();
        this.$emit('click', computedName, title);
      }
    },

    // scroll active tab into view
    scrollIntoView(immediate) {
      const { titles } = this.$refs;

      if (!this.scrollable || !titles || !titles[this.currentIndex]) {
        return;
      }

      const { nav } = this.$refs;
      const title = titles[this.currentIndex].$el;
      const to = title.offsetLeft - (nav.offsetWidth - title.offsetWidth) / 2;

      scrollLeftTo(nav, to, immediate ? 0 : this.duration);
    },

    onScroll(params) {
      this.stickyFixed = params.isFixed;
      this.$emit('scroll', params);
    },

    scrollToCurrentContent() {
      if (this.scrollspy) {
        this.clickedScroll = true;
        const instance = this.children[this.currentIndex];
        const el = instance && instance.$el;
        if (el) {
          const to = Math.ceil(getElementTop(el)) - this.scrollOffset;
          scrollTopTo(to, this.duration, () => {
            this.clickedScroll = false;
          });
        }
      }
    },

    onScrollspyScroll() {
      if (this.scrollspy && !this.clickedScroll) {
        const index = this.getCurrentIndexOnScroll();
        this.setCurrentIndex(index);
      }
    },

    getCurrentIndexOnScroll() {
      let i;

      for (i = 0; i < this.children.length; i++) {
        const top = getVisibleTop(this.children[i].$el);

        if (top > this.scrollOffset) {
          if (i === 0) {
            return 0;
          }
          return i - 1;
        }
      }

      return i - 1;
    }
  },

  render() {
    const { type, ellipsis, animated, scrollable } = this;

    const Nav = this.children.map((item, index) => (
      <Title
        ref="titles"
        refInFor
        type={type}
        dot={item.dot}
        info={item.info}
        title={item.title}
        color={this.color}
        style={item.titleStyle}
        isActive={index === this.currentIndex}
        ellipsis={ellipsis}
        disabled={item.disabled}
        scrollable={scrollable}
        activeColor={this.titleActiveColor}
        inactiveColor={this.titleInactiveColor}
        swipeThreshold={this.swipeThreshold}
        scopedSlots={{
          default: () => item.slots('title')
        }}
        onClick={() => {
          this.onClick(index);
          route(item.$router, item);
        }}
      />
    ));

    const Wrap = (
      <div
        ref="wrap"
        class={[
          bem('wrap', { scrollable }),
          { [BORDER_TOP_BOTTOM]: type === 'line' && this.border }
        ]}
      >
        <div
          ref="nav"
          role="tablist"
          class={bem('nav', [type])}
          style={this.navStyle}
        >
          {this.slots('nav-left')}
          {Nav}
          {type === 'line' && (
            <div class={bem('line')} style={this.lineStyle} />
          )}
          {this.slots('nav-right')}
        </div>
      </div>
    );

    return (
      <div class={bem([type])}>
        {this.sticky ? (
          <Sticky
            container={this.$el}
            offsetTop={this.offsetTop}
            onScroll={this.onScroll}
          >
            {Wrap}
          </Sticky>
        ) : (
          Wrap
        )}
        <Content
          count={this.children.length}
          animated={animated}
          duration={this.duration}
          swipeable={this.swipeable}
          currentIndex={this.currentIndex}
          onChange={this.setCurrentIndex}
        >
          {this.slots()}
        </Content>
      </div>
    );
  }
});
