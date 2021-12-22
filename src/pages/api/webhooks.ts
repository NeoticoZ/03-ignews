import { NextApiRequest, NextApiResponse } from "next"
import { Readable } from 'stream'
import Stripe from "stripe"
import { stripe } from "../../services/stripe"
import { saveSubscription } from "./_lib/manageSubscription"

async function buffer(readable: Readable) {
  const chunks = []

  for await (const chunk of readable) {
    chunks.push(
      typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    )
  }

  return Buffer.concat(chunks)
}

export const config = {
  api: {
    bodyParser: false
  }
}

// Cria uma array com o(s) tipos que nos são interessantes
const relevantEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'POST') {
    // Atribui o valor da {req} na função {buffer()}
    const buf = await buffer(req)

    // Busca a secret no header da {req}
    const secret = req.headers['stripe-signature']

    // Cria um evento que recebe a tipagem
    let event: Stripe.Event

    // Tenta criar um evento
    try {
      event = stripe.webhooks.constructEvent(buf, secret, process.env.STRIPE_WEBHOOK_SECRET)
    } catch (err) {
      return res.status(400).send(`Webhook error: ${err.message}`)
    }

    // Se tiver dado certo a ação anterior faz a destruturação da variável {type}
    const { type } = event

    // Verifica se o type é o mesmo definido no relevantEvents e chama a função {saveSubscription}
    if (relevantEvents.has(type)) {
      try {
        switch (type) {
          case 'customer.subscription.updated':
          case 'customer.subscription.deleted':
            const subscription = event.data.object as Stripe.Subscription;

            await saveSubscription(
              subscription.id,
              subscription.customer.toString(),
              false,
            )

            break;
          case 'checkout.session.completed':
            const checkoutSession = event.data.object as Stripe.Checkout.Session

            await saveSubscription(
              checkoutSession.subscription.toString(),
              checkoutSession.customer.toString(),
              true,
            )
          default:
            throw new Error('Unhandled event.')
        }
      } catch (err) {
        console.log(err)
        return res.json({ error: 'Webhook handler failed.' })
      }
    }

    res.json({received: true})
  } else {
    res.setHeader('Allow', 'POSTS')
    res.status(405).end('Method not allowed')
  }
}