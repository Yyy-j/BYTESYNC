// components/food-list-item/food-list-item.js
Component({
  properties: {
    mealId:    { type: String,  value: '' },
    name:      { type: String,  value: '' },
    calories:  { type: Number,  value: 0  },
    weight:    { type: Number,  value: 0  },
    protein:   { type: Number,  value: 0  },
    carbs:     { type: Number,  value: 0  },
    fat:       { type: Number,  value: 0  },
    user:      { type: String,  value: '' },  // 'me' | 'ta'
    userName:  { type: String,  value: '' },
    time:      { type: String,  value: '' },
    canDelete: { type: Boolean, value: false },
  },
  data: {},
  methods: {
    onTap() {
      this.triggerEvent('tap', { id: this.properties.mealId })
    },
    onDeleteTap() {
      this.triggerEvent('delete', { id: this.properties.mealId })
    },
  },
})
