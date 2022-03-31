import { blindexConfig } from './BlindexConfig'

export class BestRouteService {
  availableLinks = []

  constructor() {
    const availableLinks = []

    for (const pair of blindexConfig.SWAPS) {
      availableLinks.push({ from: pair.token0.toLowerCase(), to: pair.token1.toLowerCase() })
      availableLinks.push({ from: pair.token1.toLowerCase(), to: pair.token0.toLowerCase() })
    }

    this.availableLinks = availableLinks
  }

  async getBestRoute(router, amount, invokeGetAmountsIn, leftTokenAddress, rightTokenAddress) {
    const allRoutes = await this.generateRoutes(leftTokenAddress, rightTokenAddress)
    const allRoutesWithAmounts = await this.getRoutesWithAmount(
      router,
      allRoutes,
      amount,
      invokeGetAmountsIn
    )
    const bestRoute = await this.chooseBestRoute(allRoutesWithAmounts, invokeGetAmountsIn)
    return bestRoute
  }

  async getRoutesWithAmount(router, routes, amount, invokeGetAmountsIn) {
    const routesPrices = []
    for (const route of routes) {
      let amounts
      try {
        amounts = invokeGetAmountsIn
          ? await router.getAmountsIn(amount, route)
          : await router.getAmountsOut(amount, route)
      } catch (e) {
        continue // handle unsupported paths like [wrbtc -> eths -> bdx]
      }

      routesPrices.push({
        route: route,
        finalAmount: invokeGetAmountsIn ? amounts[0] : amounts[amounts.length - 1],
        amounts: amounts
      })
    }

    return routesPrices
  }

  async generateRoutes(addressIn, addressOut) {
    const midTokens = []
    addressIn = addressIn.toLowerCase()
    addressOut = addressOut.toLowerCase()
    for (const link1 of this.availableLinks) {
      if (link1.from !== addressIn) {
        continue
      }
      for (const link2 of this.availableLinks) {
        if (link1.to !== link2.from) {
          continue
        }
        if (link2.to !== addressOut) {
          continue
        }

        midTokens.push(link1.to)
      }
    }
    const routes = [...midTokens.map((x) => [addressIn, x, addressOut])]
    if (this.availableLinks.some((link) => link.from === addressIn && link.to === addressOut)) {
      routes.push([addressIn, addressOut])
    }

    return routes
  }

  async chooseBestRoute(allRoutesWithAmounts, invokeGetAmountsIn) {
    const bestPath = allRoutesWithAmounts.reduce((prev, current) => {
      const selectedRouteInfo = invokeGetAmountsIn
        ? prev.finalAmount.lt(current.finalAmount) ||
          (prev.finalAmount.eq(current.finalAmount) && prev.route.length < current.route.length)
          ? prev
          : current
        : prev.finalAmount.gt(current.finalAmount) ||
          (prev.finalAmount.eq(current.finalAmount) && prev.route.length < current.route.length)
        ? prev
        : current

      return selectedRouteInfo
    })

    return bestPath
  }
}
