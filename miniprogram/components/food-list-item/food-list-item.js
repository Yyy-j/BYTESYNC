// components/food-list-item/food-list-item.js
Component({
  properties: {
    id:       { type: String, value: '' },
    name:     { type: String, value: '' },
    calories: { type: Number, value: 0  },
    weight:   { type: Number, value: 0  },
    protein:  { type: Number, value: 0  },
    carbs:    { type: Number, value: 0  },
    fat:      { type: Number, value: 0  }
  },
  data: {},
  methods: {
    onTap() {
      this.triggerEvent('tap', { id: this.data.id })
    }
  }
})
